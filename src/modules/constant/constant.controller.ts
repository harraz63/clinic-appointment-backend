import { Request, Response } from 'express';
import { Gender } from '../../constants/gender.js';
import { Roles } from '../../constants/roles.js';
import { translateConstant } from '../../utils/translate-constant.js';
import { sendSuccess } from '../../shared/api-response.js';

export async function getGendersController(req: Request, res: Response) {
    const translatedGenders = await translateConstant(Gender, req.__);
    return sendSuccess(res, translatedGenders);
}

export async function getRolesController(req: Request, res: Response) {
    const translatedRoles = await translateConstant(Roles, req.__);
    return sendSuccess(res, translatedRoles);
}
