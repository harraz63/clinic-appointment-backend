import { StatusCodes } from 'http-status-codes';
import { Request, Response } from 'express';
import { Gender } from '../../constants/gender.js';
import { Roles } from '../../constants/roles.js';
import { translateConstant } from '../../utils/translate-constant.js';

export async function getGendersController(req: Request, res: Response) {
    const translatedGenders = await translateConstant(Gender, req.__);
    return res.status(StatusCodes.OK).json({ data: translatedGenders });
}

export async function getRolesController(req: Request, res: Response) {
    const translatedRoles = await translateConstant(Roles, req.__);
    return res.status(StatusCodes.OK).json({ data: translatedRoles });
}