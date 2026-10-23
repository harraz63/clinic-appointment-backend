import { StatusCodes } from 'http-status-codes';
import { Op, Transaction } from 'sequelize';
import { sequelize } from '../../../database/db-config.js';
import { HttpResponseError } from '../../../utils/appError.js';
import { BranchModel } from '../../branches/v1/model/branch.model.js';
import { DoctorModel } from '../../doctors/v1/model/doctor.model.js';
import { DoctorScheduleModel } from './model/doctor-schedule.model.js';
import { ScheduleExceptionModel } from './model/schedule-exception.model.js';
import { LocalizedText } from '../../../shared/localized-text.js';

export interface WorkingInterval {
    weekday: number;
    startTime: string;
    endTime: string;
}

export interface ExceptionInterval {
    startTime: string;
    endTime: string;
}

export interface ExceptionInput {
    isDayOff: boolean;
    intervals?: ExceptionInterval[];
    reason?: LocalizedText;
}

export interface DatedException extends ExceptionInput {
    date: string;
    intervals: ExceptionInterval[];
}

function assertNoOverlap<T extends { startTime: string; endTime: string }>(intervals: T[]): void {
    const ordered = [...intervals].sort((a, b) => a.startTime.localeCompare(b.startTime));
    if (ordered.some((interval, index) => index > 0 && interval.startTime < ordered[index - 1].endTime)) {
        throw new HttpResponseError(StatusCodes.CONFLICT, 'Doctor schedule intervals overlap');
    }
}

async function requireDoctor(id: string, transaction?: Transaction, lock = false): Promise<DoctorModel> {
    const doctor = await DoctorModel.findByPk(id, { transaction, ...(lock ? { lock: transaction.LOCK.UPDATE } : {}) });
    if (!doctor) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Doctor not found');
    return doctor;
}

function time(value: string): string {
    return value.slice(0, 5);
}

export class DoctorScheduleService {
    static async getWeekly(doctorId: string): Promise<{ timezone: string; intervals: WorkingInterval[] }> {
        const doctor = await requireDoctor(doctorId);
        const [branch, rows] = await Promise.all([
            BranchModel.findByPk(doctor.branchId),
            DoctorScheduleModel.findAll({ where: { doctorId }, order: [['weekday', 'ASC'], ['startTime', 'ASC']] }),
        ]);
        return { timezone: branch.timezone, intervals: rows.map(row => ({
            weekday: row.weekday, startTime: time(row.startTime), endTime: time(row.endTime),
        })) };
    }

    static async replaceWeekly(doctorId: string, intervals: WorkingInterval[]): Promise<{ timezone: string; intervals: WorkingInterval[] }> {
        await sequelize.transaction(async transaction => {
            await requireDoctor(doctorId, transaction, true);
            for (let weekday = 0; weekday <= 6; weekday++) {
                assertNoOverlap(intervals.filter(interval => interval.weekday === weekday));
            }
            await DoctorScheduleModel.destroy({ where: { doctorId }, transaction });
            if (intervals.length) await DoctorScheduleModel.bulkCreate(intervals.map(interval => ({ ...interval, doctorId })), { transaction });
        });
        return this.getWeekly(doctorId);
    }

    static async listExceptions(doctorId: string, from: string, to: string): Promise<{ timezone: string; exceptions: DatedException[] }> {
        const doctor = await requireDoctor(doctorId);
        const [branch, rows] = await Promise.all([
            BranchModel.findByPk(doctor.branchId),
            ScheduleExceptionModel.findAll({ where: { doctorId, date: { [Op.between]: [from, to] } }, order: [['date', 'ASC'], ['startTime', 'ASC']] }),
        ]);
        const byDate = new Map<string, DatedException>();
        for (const row of rows) {
            let entry = byDate.get(row.date);
            if (!entry) {
                entry = { date: row.date, isDayOff: row.isDayOff, reason: row.reason, intervals: [] };
                byDate.set(row.date, entry);
            }
            if (!row.isDayOff) entry.intervals.push({ startTime: time(row.startTime), endTime: time(row.endTime) });
        }
        return { timezone: branch.timezone, exceptions: [...byDate.values()] };
    }

    static async setException(doctorId: string, date: string, input: ExceptionInput): Promise<{ timezone: string; exception: DatedException }> {
        await sequelize.transaction(async transaction => {
            await requireDoctor(doctorId, transaction, true);
            if (!input.isDayOff) {
                if (!input.intervals?.length) throw new HttpResponseError(StatusCodes.UNPROCESSABLE_ENTITY, 'Replacement intervals are required');
                assertNoOverlap(input.intervals);
            }
            await ScheduleExceptionModel.destroy({ where: { doctorId, date }, transaction });
            const intervals = input.isDayOff ? [{ startTime: null, endTime: null }] : input.intervals ?? [];
            await ScheduleExceptionModel.bulkCreate(intervals.map(interval => ({
                doctorId, date, isDayOff: input.isDayOff, startTime: interval.startTime,
                endTime: interval.endTime, reason: input.reason ?? null,
            })), { transaction });
        });
        const result = await this.listExceptions(doctorId, date, date);
        return { timezone: result.timezone, exception: result.exceptions[0] };
    }

    static async deleteException(doctorId: string, date: string): Promise<void> {
        await sequelize.transaction(async transaction => {
            await requireDoctor(doctorId, transaction, true);
            const deleted = await ScheduleExceptionModel.destroy({ where: { doctorId, date }, transaction });
            if (!deleted) throw new HttpResponseError(StatusCodes.NOT_FOUND, 'Schedule exception not found');
        });
    }
}
