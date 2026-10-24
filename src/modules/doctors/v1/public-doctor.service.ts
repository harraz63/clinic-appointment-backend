import { col, fn, Op, Transaction, where, WhereOptions } from 'sequelize';
import { Roles } from '../../../constants/roles.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { LocalizedText } from '../../../shared/localized-text.js';
import { PaginationOptions } from '../../../shared/catalog-query.types.js';
import { BranchModel } from '../../branches/v1/model/branch.model.js';
import { SpecialtyModel } from '../../specialties/v1/model/specialty.model.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { DoctorModel } from './model/doctor.model.js';

export interface PublicDoctor {
    id: string; name: LocalizedText; biography: LocalizedText | null;
    appointmentPrice: string; currency: string; appointmentDurationMinutes: number; isAvailable: boolean;
    branch: { id: string; name: LocalizedText; address: LocalizedText; timezone: string };
    specialty: { id: string; name: LocalizedText };
}

export interface EligibleDoctor { doctor: DoctorModel; branch: BranchModel; specialty: SpecialtyModel }

export function publicDoctorProjection({ doctor, branch, specialty }: EligibleDoctor): PublicDoctor {
    return {
        id: doctor.id, name: doctor.name, biography: doctor.biography ?? null,
        appointmentPrice: doctor.appointmentPrice, currency: doctor.currency,
        appointmentDurationMinutes: doctor.appointmentDurationMinutes, isAvailable: doctor.isAvailable,
        branch: { id: branch.id, name: branch.name, address: branch.address, timezone: branch.timezone },
        specialty: { id: specialty.id, name: specialty.name },
    };
}

// Separate locked reads avoid locking the nullable side of joined associations.
export async function requireEligibleDoctor(id: string, transaction?: Transaction, unavailableStatus: 404 | 409 = 404): Promise<EligibleDoctor> {
    const doctor = await DoctorModel.findByPk(id, { transaction, ...(transaction ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!doctor) throw new HttpResponseError(404, 'Doctor not found');
    const unavailableMessage = unavailableStatus === 404 ? 'Doctor not found' : 'Doctor is unavailable for booking';
    if (!doctor.isActive) throw new HttpResponseError(unavailableStatus, unavailableMessage);
    const options = { transaction, ...(transaction ? { lock: transaction.LOCK.SHARE } : {}) };
    const user = await UserModel.findByPk(doctor.userId, options);
    const branch = await BranchModel.findByPk(doctor.branchId, options);
    const specialty = await SpecialtyModel.findByPk(doctor.specialtyId, options);
    if (!user || user.role !== Roles.DOCTOR || user.isBlocked || !branch?.isActive || !specialty?.isActive) {
        throw new HttpResponseError(unavailableStatus, unavailableMessage);
    }
    return { doctor, branch, specialty };
}

export class PublicDoctorService {
    static async get(id: string): Promise<PublicDoctor> {
        return publicDoctorProjection(await requireEligibleDoctor(id));
    }

    static async list(filter: { search?: string; branchId?: string; specialtyId?: string; isAvailable?: boolean }, pagination: PaginationOptions): Promise<{
        items: PublicDoctor[]; page: number; limit: number; total: number; totalPages: number;
    }> {
        const conditions: WhereOptions[] = [{ isActive: true }];
        if (filter.branchId) conditions.push({ branchId: filter.branchId });
        if (filter.specialtyId) conditions.push({ specialtyId: filter.specialtyId });
        if (filter.isAvailable !== undefined) conditions.push({ isAvailable: filter.isAvailable });
        if (filter.search?.trim()) conditions.push({ [Op.or]: ['ar', 'en'].map(language =>
            where(fn('jsonb_extract_path_text', col('Doctor.name'), language), { [Op.iLike]: `%${filter.search.trim()}%` })) });
        const { rows, count: total } = await DoctorModel.findAndCountAll({
            where: { [Op.and]: conditions }, distinct: true,
            include: [
                { model: UserModel, as: 'user', attributes: [], required: true, where: { role: Roles.DOCTOR, isBlocked: false } },
                { model: BranchModel, as: 'branch', required: true, where: { isActive: true } },
                { model: SpecialtyModel, as: 'specialty', required: true, where: { isActive: true } },
            ],
            limit: pagination.limit, offset: (pagination.page - 1) * pagination.limit,
            order: [['createdAt', 'DESC'], ['id', 'ASC']],
        });
        return { items: rows.map(doctor => publicDoctorProjection({
            doctor, branch: doctor.get('branch') as BranchModel, specialty: doctor.get('specialty') as SpecialtyModel,
        })), ...pagination, total, totalPages: Math.ceil(total / pagination.limit) };
    }
}
