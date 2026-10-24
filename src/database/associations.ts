import { UserModel } from '../modules/user/v1/model/user.model.js';
import { UserSessionModel } from '../modules/user-session/v1/model/user-session.entity.js';
import { BranchModel } from '../modules/branches/v1/model/branch.model.js';
import { SpecialtyModel } from '../modules/specialties/v1/model/specialty.model.js';
import { DoctorModel } from '../modules/doctors/v1/model/doctor.model.js';
import { DoctorScheduleModel } from '../modules/doctor-schedules/v1/model/doctor-schedule.model.js';
import { ScheduleExceptionModel } from '../modules/doctor-schedules/v1/model/schedule-exception.model.js';
import { AppointmentModel } from '../modules/appointments/v1/model/appointment.model.js';
import { AppointmentHistoryModel } from '../modules/appointments/v1/model/appointment-history.model.js';
import { PaymentMethodModel } from '../modules/payments/v1/model/payment-method.model.js';
import { PaymentRecordModel } from '../modules/payments/v1/model/payment-record.model.js';
import { NotificationModel } from '../modules/notifications/v1/model/notification.model.js';

let initialized = false;

export function initializeAssociations(): void {
    if (initialized) return;
    UserModel.hasOne(DoctorModel, { foreignKey: 'userId', as: 'doctorProfile' });
    DoctorModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
    BranchModel.hasMany(DoctorModel, { foreignKey: 'branchId', as: 'doctors' });
    DoctorModel.belongsTo(BranchModel, { foreignKey: 'branchId', as: 'branch' });
    SpecialtyModel.hasMany(DoctorModel, { foreignKey: 'specialtyId', as: 'doctors' });
    DoctorModel.belongsTo(SpecialtyModel, { foreignKey: 'specialtyId', as: 'specialty' });
    DoctorModel.hasMany(DoctorScheduleModel, { foreignKey: 'doctorId', as: 'schedules' });
    DoctorScheduleModel.belongsTo(DoctorModel, { foreignKey: 'doctorId', as: 'doctor' });
    DoctorModel.hasMany(ScheduleExceptionModel, { foreignKey: 'doctorId', as: 'scheduleExceptions' });
    ScheduleExceptionModel.belongsTo(DoctorModel, { foreignKey: 'doctorId', as: 'doctor' });
    UserModel.hasMany(AppointmentModel, { foreignKey: 'customerId', as: 'appointments' });
    AppointmentModel.belongsTo(UserModel, { foreignKey: 'customerId', as: 'customer' });
    DoctorModel.hasMany(AppointmentModel, { foreignKey: 'doctorId', as: 'appointments' });
    AppointmentModel.belongsTo(DoctorModel, { foreignKey: 'doctorId', as: 'doctor' });
    BranchModel.hasMany(AppointmentModel, { foreignKey: 'branchId', as: 'appointments' });
    AppointmentModel.belongsTo(BranchModel, { foreignKey: 'branchId', as: 'branch' });
    AppointmentModel.hasMany(AppointmentHistoryModel, { foreignKey: 'appointmentId', as: 'history' });
    AppointmentHistoryModel.belongsTo(AppointmentModel, { foreignKey: 'appointmentId', as: 'appointment' });
    AppointmentHistoryModel.belongsTo(UserModel, { foreignKey: 'actorId', as: 'actor' });
    AppointmentModel.hasMany(PaymentRecordModel, { foreignKey: 'appointmentId', as: 'payments' });
    PaymentRecordModel.belongsTo(AppointmentModel, { foreignKey: 'appointmentId', as: 'appointment' });
    PaymentMethodModel.hasMany(PaymentRecordModel, { foreignKey: 'paymentMethodId', as: 'payments' });
    PaymentRecordModel.belongsTo(PaymentMethodModel, { foreignKey: 'paymentMethodId', as: 'paymentMethod' });
    UserModel.hasMany(PaymentRecordModel, { foreignKey: 'receivedBy', as: 'receivedPayments' });
    PaymentRecordModel.belongsTo(UserModel, { foreignKey: 'receivedBy', as: 'receivedByUser' });
    UserModel.hasMany(NotificationModel, { foreignKey: 'recipientId', as: 'notifications' });
    NotificationModel.belongsTo(UserModel, { foreignKey: 'recipientId', as: 'recipient' });
    UserModel.hasMany(UserSessionModel, { foreignKey: 'userId', as: 'sessions' });
    UserSessionModel.belongsTo(UserModel, { foreignKey: 'userId', as: 'user' });
    initialized = true;
}
