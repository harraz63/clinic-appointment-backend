import { StatusCodes } from 'http-status-codes';
import { ForeignKeyConstraintError, Op, WhereOptions, col, fn, where } from 'sequelize';
import { AppointmentModel } from '../../appointments/v1/model/appointment.model.js';
import { DoctorModel } from '../../doctors/v1/model/doctor.model.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { CatalogFilter, PaginationOptions } from '../../../shared/catalog-query.types.js';
import { BranchInput } from './branch.types.js';
import { BranchModel } from './model/branch.model.js';

export interface BranchListResult {
    items: BranchModel[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

function buildWhere(filter: CatalogFilter, activeOnly = false): WhereOptions {
    const conditions: WhereOptions[] = [];
    if (activeOnly) conditions.push({ isActive: true });
    else if (filter.isActive !== undefined) conditions.push({ isActive: filter.isActive });

    const search = filter.search?.trim();
    if (search) {
        const pattern = `%${search}%`;
        conditions.push({
            [Op.or]: [
                where(fn('jsonb_extract_path_text', col('name'), 'ar'), { [Op.iLike]: pattern }),
                where(fn('jsonb_extract_path_text', col('name'), 'en'), { [Op.iLike]: pattern }),
            ],
        });
    }

    return conditions.length ? { [Op.and]: conditions } : {};
}

export class BranchService {
    static async create(input: BranchInput): Promise<BranchModel> {
        return BranchModel.create({ ...input, timezone: input.timezone ?? 'Africa/Cairo' });
    }

    static async list(filter: CatalogFilter, pagination: PaginationOptions, activeOnly = false): Promise<BranchListResult> {
        const whereOptions = buildWhere(filter, activeOnly);
        const offset = (pagination.page - 1) * pagination.limit;
        const [items, total] = await Promise.all([
            BranchModel.findAll({ where: whereOptions, offset, limit: pagination.limit, order: [['createdAt', 'DESC'], ['id', 'ASC']] }),
            BranchModel.count({ where: whereOptions }),
        ]);

        return { items, page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) };
    }

    static async getById(id: string): Promise<BranchModel> {
        const branch = await BranchModel.findByPk(id);
        if (!branch) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Branch not found');
        return branch;
    }

    static async update(id: string, input: Partial<BranchInput>): Promise<BranchModel> {
        const branch = await this.getById(id);
        await branch.update(input);
        return branch;
    }

    static async delete(id: string): Promise<BranchModel> {
        const branch = await this.getById(id);
        const [doctorCount, appointmentCount] = await Promise.all([
            DoctorModel.count({ where: { branchId: id } }),
            AppointmentModel.count({ where: { branchId: id } }),
        ]);

        if (doctorCount > 0 || appointmentCount > 0) {
            await branch.update({ isActive: false });
            return branch;
        }

        try {
            await branch.destroy();
            return branch;
        } catch (error) {
            if (!(error instanceof ForeignKeyConstraintError)) throw error;
            await branch.update({ isActive: false });
            return branch;
        }
    }

    static async listPublic(filter: Pick<CatalogFilter, 'search'>, pagination: PaginationOptions): Promise<BranchListResult> {
        return this.list(filter, pagination, true);
    }
}
