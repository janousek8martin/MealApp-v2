import { buildNotificationPlan, parseTimeOfDay, type NotificationToggles } from '../notifications';

const allOff: NotificationToggles = {
  mealRemindersEnabled: false,
  shoppingReminderEnabled: false,
  weighInReminderEnabled: false,
  planningReminderEnabled: false,
  weighInTime: '07:30',
  planningTime: '18:00',
};

describe('parseTimeOfDay', () => {
  it('splits an HH:MM string into hour and minute', () => {
    expect(parseTimeOfDay('07:30')).toEqual({ hour: 7, minute: 30 });
    expect(parseTimeOfDay('18:05')).toEqual({ hour: 18, minute: 5 });
  });
});

describe('buildNotificationPlan', () => {
  it('returns nothing when every toggle is off', () => {
    expect(buildNotificationPlan(allOff, [])).toEqual([]);
  });

  it('includes an enabled meal slot but skips a disabled one', () => {
    const plan = buildNotificationPlan(
      { ...allOff, mealRemindersEnabled: true },
      [
        { slotKey: 'breakfast', time: '07:30', enabled: true },
        { slotKey: 'lunch', time: '12:30', enabled: false },
      ],
    );
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: 'meal-breakfast', weekday: null, hour: 7, minute: 30 });
  });

  it('schedules the weigh-in reminder for Monday at the configured time', () => {
    const plan = buildNotificationPlan(
      { ...allOff, weighInReminderEnabled: true, weighInTime: '08:00' },
      [],
    );
    expect(plan).toEqual([
      {
        id: 'weigh-in',
        titleKey: 'notifications.weighInTitle',
        bodyKey: 'notifications.weighInBody',
        weekday: 1,
        hour: 8,
        minute: 0,
      },
    ]);
  });

  it('schedules the planning reminder for Sunday at the configured time', () => {
    const plan = buildNotificationPlan(
      { ...allOff, planningReminderEnabled: true, planningTime: '19:15' },
      [],
    );
    expect(plan[0]).toMatchObject({ id: 'planning', weekday: 7, hour: 19, minute: 15 });
  });

  it('schedules the shopping reminder when enabled', () => {
    const plan = buildNotificationPlan({ ...allOff, shoppingReminderEnabled: true }, []);
    expect(plan[0]).toMatchObject({ id: 'shopping', weekday: 6 });
  });

  it('combines every enabled reminder into one plan', () => {
    const plan = buildNotificationPlan(
      {
        mealRemindersEnabled: true,
        shoppingReminderEnabled: true,
        weighInReminderEnabled: true,
        planningReminderEnabled: true,
        weighInTime: '07:30',
        planningTime: '18:00',
      },
      [{ slotKey: 'dinner', time: '18:30', enabled: true }],
    );
    const ids = plan.map((s) => s.id).sort();
    expect(ids).toEqual(['meal-dinner', 'planning', 'shopping', 'weigh-in']);
  });
});
