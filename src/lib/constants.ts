export interface ScheduleConfig {
  slotDuration: number;
  dayStartHour: number;
  dayEndHour: number;
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  slotDuration: 30,
  dayStartHour: 8,
  dayEndHour: 20,
};
