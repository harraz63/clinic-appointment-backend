import { SpecialtyModel } from './model/specialty.model.js';

export type SpecialtyInput = Pick<SpecialtyModel, 'name'> & Partial<Pick<SpecialtyModel, 'description' | 'isActive'>>;
