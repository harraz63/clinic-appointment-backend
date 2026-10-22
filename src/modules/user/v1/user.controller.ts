import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { UserService } from './user.service.js';


export async function createUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.createUser({
        ...req.body,
        isVerified: true
    });

    res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: { user }
    });
}

export async function getUserByIdController(req: Request, res: Response): Promise<void> {
    const user = await UserService.getUserById(req.params.id);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { user }
    });
}

export async function updateUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.updateUser(req.params.id, req.body);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { user }
    });
}

export async function deleteUserController(req: Request, res: Response): Promise<void> {
    const user = await UserService.deleteUser(req.params.id);
    res.status(StatusCodes.OK).json({
        status: 'success',
        data: { user }
    });
}

export async function getUsersFilterController(req: Request, res: Response): Promise<void> {
    const { page, limit, ...filter } = req.query;

    const data = await UserService.getUsersByFilter(filter, {
        page: Number(page),
        limit: Number(limit)
    });

    res.status(StatusCodes.OK).json({
        status: 'success',
        data
    });
}