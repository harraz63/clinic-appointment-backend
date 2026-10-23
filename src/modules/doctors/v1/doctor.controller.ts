import { Request, Response } from 'express';
import { StatusCodes } from 'http-status-codes';
import { sendSuccess } from '../../../shared/api-response.js';
import { CreateDoctorInput, DoctorProfileInput } from './doctor.types.js';
import { DoctorFilter, DoctorService } from './doctor.service.js';

interface ListQuery {
    page?: string | number;
    limit?: string | number;
    search?: string;
    branchId?: string;
    specialtyId?: string;
    isActive?: string | boolean;
    isAvailable?: string | boolean;
}

function pagination(query: ListQuery) {
    return {
        page: query.page === undefined ? 1 : Number(query.page),
        limit: query.limit === undefined ? 10 : Number(query.limit),
    };
}

export async function createDoctorController(req: Request, res: Response): Promise<void> {
    const doctor = await DoctorService.create(req.body as CreateDoctorInput);
    sendSuccess(res, { doctor }, StatusCodes.CREATED);
}

export async function listDoctorsController(req: Request, res: Response): Promise<void> {
    const query = req.query as ListQuery;
    const filter: DoctorFilter = {
        search: query.search,
        branchId: query.branchId,
        specialtyId: query.specialtyId,
        ...(query.isActive === undefined ? {} : { isActive: query.isActive === true || query.isActive === 'true' }),
        ...(query.isAvailable === undefined ? {} : { isAvailable: query.isAvailable === true || query.isAvailable === 'true' }),
    };
    const result = await DoctorService.list(filter, pagination(query));
    sendSuccess(res, result);
}

export async function getDoctorController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const doctor = await DoctorService.getById(req.params.id);
    sendSuccess(res, { doctor });
}

export async function updateDoctorController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const doctor = await DoctorService.update(req.params.id, req.body as Partial<DoctorProfileInput>);
    sendSuccess(res, { doctor });
}

export async function deleteDoctorController(req: Request<{ id: string }>, res: Response): Promise<void> {
    const doctor = await DoctorService.deactivate(req.params.id);
    sendSuccess(res, { doctor });
}
