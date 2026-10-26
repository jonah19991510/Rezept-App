import { z } from "zod";

// Sport & Gesundheit, Phase S2: Stand eines Trainings vom Handy (sync_workout).

const optionalInt = (min: number, max: number) => z.number().int().min(min).max(max).nullable();
const timestamp = z.iso.datetime({ offset: true });

export const workoutPayloadSchema = z.object({
  id: z.uuid(),
  plan_id: z.uuid().nullable(),
  plan_day_id: z.uuid().nullable(),
  title: z.string().trim().min(1).max(160),
  started_at: timestamp,
  ended_at: timestamp.nullable(),
  note: z.string().max(1000),
  version: z.number().int().min(0).max(1_000_000_000),
  exercises: z
    .array(
      z.object({
        id: z.uuid(),
        exercise_id: z.uuid(),
        reps_min: optionalInt(1, 100),
        reps_max: optionalInt(1, 100),
        target_seconds: optionalInt(1, 36000),
        rest_seconds: optionalInt(0, 900),
        warmup: z.boolean(),
        note: z.string().max(200),
        sets: z
          .array(
            z.object({
              id: z.uuid(),
              kind: z.enum(["warmup", "normal"]),
              weight_kg: z.number().min(0).max(1000).nullable(),
              reps: optionalInt(0, 1000),
              seconds: optionalInt(0, 86400),
              distance_m: z.number().min(0).max(1_000_000).nullable(),
              done: z.boolean(),
              done_at: timestamp.nullable(),
            }),
          )
          .max(50),
      }),
    )
    .max(60),
});
