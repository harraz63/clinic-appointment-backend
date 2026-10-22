import { HttpResponseError } from '../../../utils/appError.js';
import { StatusCodes } from 'http-status-codes';
import { UserModel } from './model/user.model.js';
import { isStrongPassword } from '../../../utils/password.utils.js';


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

    static getUserByProvider(provider: string) {
        return UserModel.findOne({ where: { provider } });
    }

    static async createUser(userData: Partial<UserModel>): Promise<UserModel> {
        const existingUser = await UserModel.findOne({ where: { provider: userData.provider } });
        if (existingUser) {
            throw new HttpResponseError(StatusCodes.CONFLICT, 'User with this provider already exists');
        }

        if (userData.password && !isStrongPassword(userData.password)) {
            throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character');
        }

        const user = new UserModel(userData);
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
        await user.update(updateData);
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
        filter: any = {},
        options: PaginateOptions = {}
    ): Promise<PaginationResult> {
        const { page = 1, limit = 10 } = options;
        const skip = (Number(page) - 1) * Number(limit);
        if (filter.name) {
            filter.name = { $regex: new RegExp(filter.name, 'i') }; // Partial, case-insensitive match
        }
        if (filter.provider) {
            filter.provider = { $regex: new RegExp(filter.provider, 'i') }; // Partial, case-insensitive match
        }

        const [users, total] = await Promise.all([
            UserModel.findAll({
                where: filter,
                offset: skip,
                limit: Number(limit)
            }),
            UserModel.count({ where: filter })
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