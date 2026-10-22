import { UserModel } from "../../../user/v1/model/user.model.js";
import { UserSessionModel } from "./user-session.entity.js";


UserModel.hasMany(UserSessionModel, { foreignKey: 'userId', as: 'sessions' });
UserSessionModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });