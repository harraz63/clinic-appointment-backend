import { BranchModel } from './model/branch.model.js';

export type BranchInput = Pick<BranchModel, 'name' | 'address'> &
    Partial<Pick<BranchModel, 'description' | 'phone' | 'email' | 'timezone' | 'isActive'>>;
