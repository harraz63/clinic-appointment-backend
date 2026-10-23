import { StatusCodes } from 'http-status-codes';
import { col, fn, Includeable, Op, Transaction, UniqueConstraintError, WhereOptions, where } from 'sequelize';
import { env } from '../../../config/env.js';
import { Roles } from '../../../constants/roles.js';
import { sequelize } from '../../../database/db-config.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { isStrongPassword } from '../../../utils/password.utils.js';
import { normalizeEgyptianPhone } from '../../../utils/phone.utils.js';
import { PaginationOptions } from '../../../shared/catalog-query.types.js';
import { BranchModel } from '../../branches/v1/model/branch.model.js';
import { SpecialtyModel } from '../../specialties/v1/model/specialty.model.js';
import { UserModel } from '../../user/v1/model/user.model.js';
import { DoctorScheduleModel } from '../../doctor-schedules/v1/model/doctor-schedule.model.js';
import { ScheduleExceptionModel } from '../../doctor-schedules/v1/model/schedule-exception.model.js';
import { DoctorModel } from './model/doctor.model.js';
import { CreateDoctorInput, DoctorProfileInput } from './doctor.types.js';

export interface DoctorFilter {
    search?: string;
    branchId?: string;
    specialtyId?: string;
    isActive?: boolean;
    isAvailable?: boolean;
}

export interface DoctorListResult {
    items: DoctorModel[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const doctorIncludes: Includeable[] = [
    { model: UserModel, as: 'user', required: true },
    { model: BranchModel, as: 'branch', required: true },
    { model: SpecialtyModel, as: 'specialty', required: true },
];

function buildWhere(filter: DoctorFilter): WhereOptions {
    const conditions: WhereOptions[] = [];
    if (filter.branchId) conditions.push({ branchId: filter.branchId });
    if (filter.specialtyId) conditions.push({ specialtyId: filter.specialtyId });
    if (filter.isActive !== undefined) conditions.push({ isActive: filter.isActive });
    if (filter.isAvailable !== undefined) conditions.push({ isAvailable: filter.isAvailable });

    const search = filter.search?.trim();
    if (search) {
        const pattern = `%${search}%`;
        conditions.push({
            [Op.or]: [
                where(fn('jsonb_extract_path_text', col('Doctor.name'), 'ar'), { [Op.iLike]: pattern }),
                where(fn('jsonb_extract_path_text', col('Doctor.name'), 'en'), { [Op.iLike]: pattern }),
            ],
        });
    }

    return conditions.length ? { [Op.and]: conditions } : {};
}

async function requireActiveAssignment(branchId: string, specialtyId: string, transaction?: Transaction): Promise<void> {
    const [branch, specialty] = await Promise.all([
        BranchModel.findByPk(branchId, { transaction }),
        SpecialtyModel.findByPk(specialtyId, { transaction }),
    ]);
    if (!branch || !branch.isActive) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Doctor branch must be active');
    if (!specialty || !specialty.isActive) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Doctor specialty must be active');
}

export class DoctorService {
    static async create(input: CreateDoctorInput): Promise<DoctorModel> {
        if (!isStrongPassword(input.password)) {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }

        const phone = normalizeEgyptianPhone(input.phone);
        try {
            const doctorId = await sequelize.transaction(async transaction => {
                await requireActiveAssignment(input.branchId, input.specialtyId, transaction);
                const existingUser = await UserModel.findOne({ where: { phone }, transaction });
                if (existingUser) throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone already exists');

                const user = await UserModel.create({
                    phone,
                    name: input.accountName,
                    password: input.password,
                    role: Roles.DOCTOR,
                    isVerified: true,
                    isBlocked: false,
                }, { transaction });
                const doctor = await DoctorModel.create({
                    userId: user.id,
                    branchId: input.branchId,
                    specialtyId: input.specialtyId,
                    name: input.name,
                    biography: input.biography,
                    appointmentPrice: input.appointmentPrice,
                    currency: input.currency ?? env.CLINIC_CURRENCY,
                    appointmentDurationMinutes: input.appointmentDurationMinutes,
                    isAvailable: input.isAvailable ?? true,
                    isActive: input.isActive ?? true,
                }, { transaction });
                return doctor.id;
            });
            return this.getById(doctorId);
        } catch (error) {
            if (error instanceof UniqueConstraintError) {
                throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone already exists');
            }
            throw error;
        }
    }

    static async list(filter: DoctorFilter, pagination: PaginationOptions): Promise<DoctorListResult> {
        const whereOptions = buildWhere(filter);
        const offset = (pagination.page - 1) * pagination.limit;
        const { rows: items, count: total } = await DoctorModel.findAndCountAll({
            where: whereOptions,
            include: doctorIncludes,
            distinct: true,
            offset,
            limit: pagination.limit,
            order: [['createdAt', 'DESC'], ['id', 'ASC']],
        });
        return { items, page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) };
    }

    static async getById(id: string): Promise<DoctorModel> {
        const doctor = await DoctorModel.findByPk(id, { include: doctorIncludes });
        if (!doctor) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Doctor not found');
        return doctor;
    }

    static async update(id: string, input: Partial<DoctorProfileInput>): Promise<DoctorModel> {
        await sequelize.transaction(async transaction => {
            const doctor = await DoctorModel.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
            if (!doctor) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Doctor not found');

            const branchId = input.branchId ?? doctor.branchId;
            const specialtyId = input.specialtyId ?? doctor.specialtyId;
            if (input.branchId !== undefined || input.specialtyId !== undefined || input.isActive === true) {
                await requireActiveAssignment(branchId, specialtyId, transaction);
            }
            if (branchId !== doctor.branchId) {
                const [scheduleCount, exceptionCount] = await Promise.all([
                    DoctorScheduleModel.count({ where: { doctorId: id }, transaction }),
                    ScheduleExceptionModel.count({ where: { doctorId: id }, transaction }),
                ]);
                if (scheduleCount || exceptionCount) {
                    throw new HttpResponseError(StatusCodes.CONFLICT, 'Clear doctor schedule before changing branch');
                }
            }
            await doctor.update(input, { transaction });
        });
        return this.getById(id);
    }

    static async deactivate(id: string): Promise<DoctorModel> {
        const doctor = await DoctorModel.findByPk(id);
        if (!doctor) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Doctor not found');
        await doctor.update({ isActive: false });
        return this.getById(id);
    }
}
