import { StatusCodes } from 'http-status-codes';
import { ForeignKeyConstraintError, Op, WhereOptions, col, fn, where } from 'sequelize';
import { DoctorModel } from '../../doctors/v1/model/doctor.model.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { CatalogFilter, PaginationOptions } from '../../../shared/catalog-query.types.js';
import { SpecialtyInput } from './specialty.types.js';
import { SpecialtyModel } from './model/specialty.model.js';

export interface SpecialtyListResult {
    items: SpecialtyModel[];
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

export class SpecialtyService {
    static async create(input: SpecialtyInput): Promise<SpecialtyModel> {
        return SpecialtyModel.create(input);
    }

    static async list(filter: CatalogFilter, pagination: PaginationOptions, activeOnly = false): Promise<SpecialtyListResult> {
        const whereOptions = buildWhere(filter, activeOnly);
        const offset = (pagination.page - 1) * pagination.limit;
        const [items, total] = await Promise.all([
            SpecialtyModel.findAll({ where: whereOptions, offset, limit: pagination.limit, order: [['createdAt', 'DESC'], ['id', 'ASC']] }),
            SpecialtyModel.count({ where: whereOptions }),
        ]);

        return { items, page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) };
    }

    static async getById(id: string): Promise<SpecialtyModel> {
        const specialty = await SpecialtyModel.findByPk(id);
        if (!specialty) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Specialty not found');
        return specialty;
    }

    static async update(id: string, input: Partial<SpecialtyInput>): Promise<SpecialtyModel> {
        const specialty = await this.getById(id);
        await specialty.update(input);
        return specialty;
    }

    static async delete(id: string): Promise<SpecialtyModel> {
        const specialty = await this.getById(id);
        const doctorCount = await DoctorModel.count({ where: { specialtyId: id } });
        if (doctorCount > 0) {
            await specialty.update({ isActive: false });
            return specialty;
        }

        try {
            await specialty.destroy();
            return specialty;
        } catch (error) {
            if (!(error instanceof ForeignKeyConstraintError)) throw error;
            await specialty.update({ isActive: false });
            return specialty;
        }
    }

    static async listPublic(filter: Pick<CatalogFilter, 'search'>, pagination: PaginationOptions): Promise<SpecialtyListResult> {
        return this.list(filter, pagination, true);
    }
}
