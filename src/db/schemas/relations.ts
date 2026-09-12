import { defineRelations } from "drizzle-orm";
import { user, session, account, verification } from "./auth-schema";
import {
  relative,
  citizen,
  employee,
  relativeCitizen,
} from "./subUser-schema";

export const relations = defineRelations(
  {
    user,
    session,
    account,
    verification,
    relative,
    citizen,
    employee,
    relativeCitizen,
  },
  (r) => ({
    user: {
      sessions: r.many.session({
        from: r.user.id,
        to: r.session.userId,
      }),
      accounts: r.many.account({
        from: r.user.id,
        to: r.account.userId,
      }),
      relative: r.one.relative({
        from: r.user.id,
        to: r.relative.userId,
      }),
      citizen: r.one.citizen({
        from: r.user.id,
        to: r.citizen.userId,
      }),
      employee: r.one.employee({
        from: r.user.id,
        to: r.employee.userId,
      }),
    },
    session: {
      user: r.one.user({
        from: r.session.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    account: {
      user: r.one.user({
        from: r.account.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    relative: {
      user: r.one.user({
        from: r.relative.userId,
        to: r.user.id,
        optional: false,
      }),
      citizens: r.many.citizen({
        from: r.relative.userId.through(r.relativeCitizen.relativeUserId),
        to: r.citizen.userId.through(r.relativeCitizen.citizenUserId),
      }),
    },
    citizen: {
      user: r.one.user({
        from: r.citizen.userId,
        to: r.user.id,
        optional: false,
      }),
      relatives: r.many.relative({
        from: r.citizen.userId.through(r.relativeCitizen.citizenUserId),
        to: r.relative.userId.through(r.relativeCitizen.relativeUserId),
      }),
    },
    employee: {
      user: r.one.user({
        from: r.employee.userId,
        to: r.user.id,
        optional: false,
      }),
    },
    relativeCitizen: {
      relative: r.one.relative({
        from: r.relativeCitizen.relativeUserId,
        to: r.relative.userId,
        optional: false,
      }),
      citizen: r.one.citizen({
        from: r.relativeCitizen.citizenUserId,
        to: r.citizen.userId,
        optional: false,
      }),
    },
  }),
);
