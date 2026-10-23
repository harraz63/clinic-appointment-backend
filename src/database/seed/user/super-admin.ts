import { UserModel } from '../../../modules/user/v1/model/user.model.js';
import { Roles } from '../../../constants/roles.js';
import { env } from '../../../config/env.js';
import { normalizeEgyptianPhone } from '../../../utils/phone.utils.js';


export async function initializeSuperAdmin() {
    try {
        const phone = normalizeEgyptianPhone(env.SUPER_ADMIN_PHONE);
        const existingUser = await UserModel.findOne({ where: { phone } });
        if (existingUser) {
            existingUser.password = env.SUPER_ADMIN_PASSWORD;
            await existingUser.save();
        }
        else {
            const user = await UserModel.create({
                phone,
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
