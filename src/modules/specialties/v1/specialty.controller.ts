import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../../shared/api-response.js';
import { CatalogFilter } from '../../../shared/catalog-query.types.js';
import { SpecialtyInput } from './specialty.types.js';
import { SpecialtyService } from './specialty.service.js';

interface ListQuery {
    page?: string | number;
    limit?: string | number;
    search?: string;
    isActive?: string | boolean;
}

function pagination(query: ListQuery) {
    return {
        page: query.page === undefined ? 1 : Number(query.page),
        limit: query.limit === undefined ? 10 : Number(query.limit),
    };
}

function filter(query: ListQuery): CatalogFilter {
    return {
        search: query.search,
        ...(query.isActive === undefined ? {} : { isActive: query.isActive === true || query.isActive === 'true' }),
    };
}

export async function createSpecialtyController(req: Request, res: Response): Promise<void> {
    const specialty = await SpecialtyService.create(req.body as SpecialtyInput);
    sendSuccess(res, { specialty }, StatusCodes.CREATED);
}

export async function listSpecialtiesController(req: Request, res: Response): Promise<void> {
    const query = req.query as ListQuery;
    const result = await SpecialtyService.list(filter(query), pagination(query));
    sendSuccess(res, result);
}

export async function listPublicSpecialtiesController(req: Request, res: Response): Promise<void> {
    const query = req.query as ListQuery;
    const result = await SpecialtyService.listPublic({ search: query.search }, pagination(query));
    sendSuccess(res, result);
}

export async function getSpecialtyController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const specialty = await SpecialtyService.getById(req.params.id);
    sendSuccess(res, { specialty });
}

export async function updateSpecialtyController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const specialty = await SpecialtyService.update(req.params.id, req.body as Partial<SpecialtyInput>);
    sendSuccess(res, { specialty });
}

export async function deleteSpecialtyController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const specialty = await SpecialtyService.delete(req.params.id);
    sendSuccess(res, { specialty });
}
