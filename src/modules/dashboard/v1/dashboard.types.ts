export interface DashboardFilter {
    from?: string;
    to?: string;
    branchId?: string;
}

export interface AdminDashboard {
    totalBranches: number;
    totalDoctors: number;
    totalCustomers: number;
    totalAppointments: number;
    todayAppointments: number;
    appointmentsByStatus: Record<string, number>;
    collectedRevenue: string;
    unpaidAmount: string;
    currency: string;
    byBranch: Array<{ branchId: string; totalAppointments: number }>;
    byDoctor: Array<{ doctorId: string; totalAppointments: number }>;
}

export interface DoctorDashboard {
    todayAppointments: number;
    upcomingAppointments: number;
    appointmentsByStatus: Record<string, number>;
    unreadNotifications: number;
}
// Contracts only; no query implementation or mounted endpoint.
