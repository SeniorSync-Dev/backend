import { defineRelations } from "drizzle-orm";
import {
    user,
    session,
    account,
    verification,
    organization,
    member,
    invitation,
} from "./auth-schema";
import { relative, citizen, employee, relativeCitizen } from "./subUser-schema";
import {
    facillity,
    employeeFacilities,
    citizenFacilities,
    address,
} from "./facillity-schema";
import {
    activity,
    activitySignup,
    activityEmployeeAssignment,
} from "./activity-schema";
import { careTask } from "./care-task-schema";
import {
    medicationDevice,
    citizenMedicationDevice,
    medicationPlan,
    medicationSchedule,
    medicationEvent,
} from "./medication-schema";
import {
    sensorDevice,
    citizenSensorDevice,
    sensorEvent,
} from "./sensor-schema";

export const relations = defineRelations(
    {
        user,
        session,
        account,
        verification,
        organization,
        member,
        invitation,
        relative,
        citizen,
        employee,
        relativeCitizen,
        facillity,
        employeeFacilities,
        citizenFacilities,
        address,
        activity,
        activitySignup,
        activityEmployeeAssignment,
        careTask,
        medicationDevice,
        citizenMedicationDevice,
        medicationPlan,
        medicationSchedule,
        medicationEvent,
        sensorDevice,
        citizenSensorDevice,
        sensorEvent,
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
                optional: true,
            }),
            createdActivities: r.many.activity({
                from: r.user.id,
                to: r.activity.createdByUserId,
            }),
            bookedActivitySignups: r.many.activitySignup({
                from: r.user.id,
                to: r.activitySignup.bookedByUserId,
            }),
            createdCareTasks: r.many.careTask({
                from: r.user.id,
                to: r.careTask.createdByUserId,
            }),
            createdMedicationPlans: r.many.medicationPlan({
                from: r.user.id,
                to: r.medicationPlan.createdByUserId,
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
        organization: {
            members: r.many.member({
                from: r.organization.id,
                to: r.member.organizationId,
            }),
            invitations: r.many.invitation({
                from: r.organization.id,
                to: r.invitation.organizationId,
            }),
            facilities: r.many.facillity({
                from: r.organization.id,
                to: r.facillity.organizationId,
            }),
        },
        member: {
            organization: r.one.organization({
                from: r.member.organizationId,
                to: r.organization.id,
                optional: false,
            }),
            user: r.one.user({
                from: r.member.userId,
                to: r.user.id,
                optional: false,
            }),
        },
        invitation: {
            organization: r.one.organization({
                from: r.invitation.organizationId,
                to: r.organization.id,
                optional: false,
            }),
            inviter: r.one.user({
                from: r.invitation.inviterId,
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
            address: r.one.address({
                from: r.relative.addressId,
                to: r.address.id,
            }),
            citizens: r.many.citizen({
                from: r.relative.userId.through(
                    r.relativeCitizen.relativeUserId,
                ),
                to: r.citizen.userId.through(r.relativeCitizen.citizenUserId),
            }),
        },
        citizen: {
            user: r.one.user({
                from: r.citizen.userId,
                to: r.user.id,
                optional: false,
            }),
            address: r.one.address({
                from: r.citizen.addressId,
                to: r.address.id,
            }),
            relatives: r.many.relative({
                from: r.citizen.userId.through(r.relativeCitizen.citizenUserId),
                to: r.relative.userId.through(r.relativeCitizen.relativeUserId),
            }),
            facilities: r.many.facillity({
                from: r.citizen.userId.through(
                    r.citizenFacilities.citizenUserId,
                ),
                to: r.facillity.id.through(r.citizenFacilities.facilityId),
            }),
            activitySignups: r.many.activitySignup({
                from: r.citizen.userId,
                to: r.activitySignup.citizenUserId,
            }),
            careTasks: r.many.careTask({
                from: r.citizen.userId,
                to: r.careTask.citizenUserId,
            }),
            medicationDevices: r.many.medicationDevice({
                from: r.citizen.userId.through(
                    r.citizenMedicationDevice.citizenUserId,
                ),
                to: r.medicationDevice.id.through(
                    r.citizenMedicationDevice.deviceId,
                ),
            }),
            medicationPlans: r.many.medicationPlan({
                from: r.citizen.userId,
                to: r.medicationPlan.citizenUserId,
            }),
            medicationEvents: r.many.medicationEvent({
                from: r.citizen.userId,
                to: r.medicationEvent.citizenUserId,
            }),
            sensorDevices: r.many.sensorDevice({
                from: r.citizen.userId.through(
                    r.citizenSensorDevice.citizenUserId,
                ),
                to: r.sensorDevice.id.through(r.citizenSensorDevice.deviceId),
            }),
            sensorEvents: r.many.sensorEvent({
                from: r.citizen.userId,
                to: r.sensorEvent.citizenUserId,
            }),
        },
        employee: {
            user: r.one.user({
                from: r.employee.userId,
                to: r.user.id,
                optional: true,
            }),
            address: r.one.address({
                from: r.employee.addressId,
                to: r.address.id,
            }),
            facilities: r.many.facillity({
                from: r.employee.id.through(r.employeeFacilities.employeeId),
                to: r.facillity.id.through(r.employeeFacilities.facilityId),
            }),
            activityAssignments: r.many.activityEmployeeAssignment({
                from: r.employee.id,
                to: r.activityEmployeeAssignment.employeeId,
            }),
            assignedCareTasks: r.many.careTask({
                from: r.employee.id,
                to: r.careTask.assignedEmployeeId,
            }),
            completedCareTasks: r.many.careTask({
                from: r.employee.id,
                to: r.careTask.completedByEmployeeId,
            }),
            acknowledgedSensorEvents: r.many.sensorEvent({
                from: r.employee.id,
                to: r.sensorEvent.acknowledgedByEmployeeId,
            }),
            resolvedSensorEvents: r.many.sensorEvent({
                from: r.employee.id,
                to: r.sensorEvent.resolvedByEmployeeId,
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
        facillity: {
            organization: r.one.organization({
                from: r.facillity.organizationId,
                to: r.organization.id,
                optional: false,
            }),
            citizens: r.many.citizen({
                from: r.facillity.id.through(r.citizenFacilities.facilityId),
                to: r.citizen.userId.through(r.citizenFacilities.citizenUserId),
            }),
            employees: r.many.employee({
                from: r.facillity.id.through(r.employeeFacilities.facilityId),
                to: r.employee.id.through(r.employeeFacilities.employeeId),
            }),
            address: r.one.address({
                from: r.facillity.addressId,
                to: r.address.id,
                optional: false,
            }),
            activities: r.many.activity({
                from: r.facillity.id,
                to: r.activity.organizerFacilityId,
            }),
            careTasks: r.many.careTask({
                from: r.facillity.id,
                to: r.careTask.facilityId,
            }),
        },
        employeeFacilities: {
            employee: r.one.employee({
                from: r.employeeFacilities.employeeId,
                to: r.employee.id,
                optional: false,
            }),
            facility: r.one.facillity({
                from: r.employeeFacilities.facilityId,
                to: r.facillity.id,
                optional: false,
            }),
        },
        citizenFacilities: {
            citizen: r.one.citizen({
                from: r.citizenFacilities.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            facility: r.one.facillity({
                from: r.citizenFacilities.facilityId,
                to: r.facillity.id,
                optional: false,
            }),
        },
        address: {
            facilities: r.many.facillity({
                from: r.address.id,
                to: r.facillity.addressId,
            }),
        },
        activity: {
            organizerFacility: r.one.facillity({
                from: r.activity.organizerFacilityId,
                to: r.facillity.id,
                optional: false,
            }),
            createdBy: r.one.user({
                from: r.activity.createdByUserId,
                to: r.user.id,
                optional: false,
            }),
            locationAddress: r.one.address({
                from: r.activity.locationAddressId,
                to: r.address.id,
            }),
            signups: r.many.activitySignup({
                from: r.activity.id,
                to: r.activitySignup.activityId,
            }),
            employeeAssignments: r.many.activityEmployeeAssignment({
                from: r.activity.id,
                to: r.activityEmployeeAssignment.activityId,
            }),
        },
        activitySignup: {
            activity: r.one.activity({
                from: r.activitySignup.activityId,
                to: r.activity.id,
                optional: false,
            }),
            citizen: r.one.citizen({
                from: r.activitySignup.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            bookedBy: r.one.user({
                from: r.activitySignup.bookedByUserId,
                to: r.user.id,
                optional: false,
            }),
        },
        activityEmployeeAssignment: {
            activity: r.one.activity({
                from: r.activityEmployeeAssignment.activityId,
                to: r.activity.id,
                optional: false,
            }),
            employee: r.one.employee({
                from: r.activityEmployeeAssignment.employeeId,
                to: r.employee.id,
                optional: false,
            }),
        },
        careTask: {
            citizen: r.one.citizen({
                from: r.careTask.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            assignedEmployee: r.one.employee({
                from: r.careTask.assignedEmployeeId,
                to: r.employee.id,
            }),
            facility: r.one.facillity({
                from: r.careTask.facilityId,
                to: r.facillity.id,
            }),
            createdBy: r.one.user({
                from: r.careTask.createdByUserId,
                to: r.user.id,
                optional: false,
            }),
            completedByEmployee: r.one.employee({
                from: r.careTask.completedByEmployeeId,
                to: r.employee.id,
            }),
        },
        medicationDevice: {
            citizens: r.many.citizen({
                from: r.medicationDevice.id.through(
                    r.citizenMedicationDevice.deviceId,
                ),
                to: r.citizen.userId.through(
                    r.citizenMedicationDevice.citizenUserId,
                ),
            }),
            events: r.many.medicationEvent({
                from: r.medicationDevice.id,
                to: r.medicationEvent.deviceId,
            }),
        },
        citizenMedicationDevice: {
            citizen: r.one.citizen({
                from: r.citizenMedicationDevice.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            device: r.one.medicationDevice({
                from: r.citizenMedicationDevice.deviceId,
                to: r.medicationDevice.id,
                optional: false,
            }),
        },
        medicationPlan: {
            citizen: r.one.citizen({
                from: r.medicationPlan.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            createdBy: r.one.user({
                from: r.medicationPlan.createdByUserId,
                to: r.user.id,
                optional: false,
            }),
            schedules: r.many.medicationSchedule({
                from: r.medicationPlan.id,
                to: r.medicationSchedule.medicationPlanId,
            }),
        },
        medicationSchedule: {
            plan: r.one.medicationPlan({
                from: r.medicationSchedule.medicationPlanId,
                to: r.medicationPlan.id,
                optional: false,
            }),
            events: r.many.medicationEvent({
                from: r.medicationSchedule.id,
                to: r.medicationEvent.medicationScheduleId,
            }),
        },
        medicationEvent: {
            citizen: r.one.citizen({
                from: r.medicationEvent.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            device: r.one.medicationDevice({
                from: r.medicationEvent.deviceId,
                to: r.medicationDevice.id,
            }),
            schedule: r.one.medicationSchedule({
                from: r.medicationEvent.medicationScheduleId,
                to: r.medicationSchedule.id,
            }),
        },
        sensorDevice: {
            citizens: r.many.citizen({
                from: r.sensorDevice.id.through(r.citizenSensorDevice.deviceId),
                to: r.citizen.userId.through(
                    r.citizenSensorDevice.citizenUserId,
                ),
            }),
            events: r.many.sensorEvent({
                from: r.sensorDevice.id,
                to: r.sensorEvent.deviceId,
            }),
        },
        citizenSensorDevice: {
            citizen: r.one.citizen({
                from: r.citizenSensorDevice.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            device: r.one.sensorDevice({
                from: r.citizenSensorDevice.deviceId,
                to: r.sensorDevice.id,
                optional: false,
            }),
        },
        sensorEvent: {
            citizen: r.one.citizen({
                from: r.sensorEvent.citizenUserId,
                to: r.citizen.userId,
                optional: false,
            }),
            device: r.one.sensorDevice({
                from: r.sensorEvent.deviceId,
                to: r.sensorDevice.id,
                optional: false,
            }),
            acknowledgedByEmployee: r.one.employee({
                from: r.sensorEvent.acknowledgedByEmployeeId,
                to: r.employee.id,
            }),
            resolvedByEmployee: r.one.employee({
                from: r.sensorEvent.resolvedByEmployeeId,
                to: r.employee.id,
            }),
        },
    }),
);
