import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { UserService, UserFilter } from './user.service.js';
import { sendSuccess } from '../../../shared/api-response.js';


export async function createUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.createUser({
        ...req.body,
        isVerified: true
    });

    sendSuccess(res, { user }, StatusCodes.CREATED);
}

export async function getUserByIdController(req: Request, res: Response): Promise<void> {
    const user = await UserService.getUserById(req.params.id);
    sendSuccess(res, { user });
}

export async function updateUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.updateUser(req.params.id, req.body);
    sendSuccess(res, { user });
}

export async function deleteUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.deleteUser(req.params.id);
    sendSuccess(res, { user });
}

export async function getUsersFilterController(req: Request, res: Response): Promise<void> {
    const { page, limit, ...filter } = req.query;

    const data = await UserService.getUsersByFilter(filter as UserFilter, {
        page: page === undefined ? 1 : Number(page),
        limit: limit === undefined ? 10 : Number(limit)
    });

    sendSuccess(res, data);
}
