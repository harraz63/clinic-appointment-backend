import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';
import { UserModel } from './model/user.model.js';
import { Op, WhereOptions } from 'sequelize';
import { Role } from '../../../constants/roles.js';
import { isStrongPassword } from '../../../utils/password.utils.js';
import { normalizeEgyptianPhone } from '../../../utils/phone.utils.js';


export interface UserFilter {
    name?: string;
    phone?: string;
    role?: Role;
    isVerified?: boolean;
    isBlocked?: boolean;
}

interface PaginateOptions {
    page?: number;
    limit?: number;
}

interface PaginationResult {
    users: UserModel[];
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export class UserService {

    static getUserByPhone(phone: string) {
        return UserModel.findOne({ where: { phone: normalizeEgyptianPhone(phone) } });
    }

    static async createUser(userData: Partial<UserModel>): Promise<UserModel> {
        if (!userData.phone) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Phone must be a valid Egyptian mobile number');
        const phone = normalizeEgyptianPhone(userData.phone);
        const existingUser = await UserModel.findOne({ where: { phone } });
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone already exists');
        }

        if (userData.password && !isStrongPassword(userData.password)) {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }

        const user = new UserModel({ ...userData, phone });
        await user.save();
        return this.getUserById(user.id.toString());
    }

    static async getUserById(userId: string): Promise<UserModel> {
        const user = await UserModel.findByPk(userId);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }
        return user;
    }

    static async updateUser(userId: string, updateData: Partial<UserModel>): Promise<UserModel> {
        const user = await UserModel.findByPk(userId);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }
        const changes = { ...updateData };
        if (changes.phone) {
            changes.phone = normalizeEgyptianPhone(changes.phone);
            const duplicate = await UserModel.findOne({ where: { phone: changes.phone } });
            if (duplicate && duplicate.id !== user.id) throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this phone already exists');
            changes.isVerified = true;
        }
        await user.update(changes);
        return this.getUserById(user.id.toString());
    }


    static async deleteUser(userId: string): Promise<UserModel> {
        const user = await UserModel.findByPk(userId);
        if (!user) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'User not found');
        }
        await user.destroy();
        return user;
    }

    static async getUsersByFilter(
        filter: UserFilter = {},
        options: PaginateOptions = {}
    ): Promise<PaginationResult> {
        const { page = 1, limit = 10 } = options;
        const skip = (Number(page) - 1) * Number(limit);
        const where: WhereOptions = { ...filter };
        if (filter.name) where.name = { [Op.iLike]: '%' + filter.name + '%' };
        if (filter.phone) where.phone = { [Op.iLike]: '%' + normalizeEgyptianPhone(filter.phone) + '%' };

        const [users, total] = await Promise.all([
            UserModel.findAll({
                where,
                offset: skip,
                limit: Number(limit)
            }),
            UserModel.count({ where })
        ]);

        if (!users.length) {
            throw new HttpResponseError(StatusCodes.NOT_FOUND, 'No users found with the given filter');
        }

        return {
            users,
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit))
        };
    }
}
