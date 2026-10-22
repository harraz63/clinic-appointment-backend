import { UserModel } from '../../../modules/user/v1/model/user.model.js';
import { Roles } from '../../../constants/roles.js';
import { env } from '../../../config/env.js';


export async function initializeSuperAdmin() {
    try {
        const existingUser = await UserModel.findOne({ where: { provider: env.SUPER_ADMIN_PROVIDER } });
        if (existingUser) {
            existingUser.password = env.SUPER_ADMIN_PASSWORD;
            await existingUser.save();
        }
        else {
            const user = await UserModel.create({
                provider: env.SUPER_ADMIN_PROVIDER,
                password: env.SUPER_ADMIN_PASSWORD,
                name: 'Super Admin',
                role: Roles.ADMIN,
                isVerified: true,
                isBlocked: false,
            });
            await user.save();
        }
    }
    catch (ex) {
        throw new Error(`FATAL ERROR: Super Admin is not created.\n${ex}`);
    }
}