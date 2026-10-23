import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../../shared/api-response.js';
import { CatalogFilter } from '../../../shared/catalog-query.types.js';
import { BranchInput } from './branch.types.js';
import { BranchService } from './branch.service.js';

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

export async function createBranchController(req: Request, res: Response): Promise<void> {
    const branch = await BranchService.create(req.body as BranchInput);
    sendSuccess(res, { branch }, StatusCodes.CREATED);
}

export async function listBranchesController(req: Request, res: Response): Promise<void> {
    const query = req.query as ListQuery;
    const result = await BranchService.list(filter(query), pagination(query));
    sendSuccess(res, result);
}

export async function listPublicBranchesController(req: Request, res: Response): Promise<void> {
    const query = req.query as ListQuery;
    const result = await BranchService.listPublic({ search: query.search }, pagination(query));
    sendSuccess(res, result);
}

export async function getBranchController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const branch = await BranchService.getById(req.params.id);
    sendSuccess(res, { branch });
}

export async function updateBranchController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const branch = await BranchService.update(req.params.id, req.body as Partial<BranchInput>);
    sendSuccess(res, { branch });
}

export async function deleteBranchController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const branch = await BranchService.delete(req.params.id);
    sendSuccess(res, { branch });
}
