import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    project: ["create", "share", "update", "delete"], // <-- Permissions available for created roles
    organization: ["create", "share", "update", "delete"], // <-- Permissions available for created roles
    member: ["create", "update", "delete"], // <-- Needed to assign/change a member's role
    invitation: ["create", "cancel"], // <-- Needed to invite new users into the organization
    activity: ["create", "update", "delete"], // <-- Needed to create, update and delete activities
} as const;

export const ac = createAccessControl(statement);

export const citizen = ac.newRole({
    project: ["create"],
});
export const relative = ac.newRole({
    project: ["create"],
});
export const employee = ac.newRole({
    project: ["create"],
});
export const servicePartner = ac.newRole({
    project: ["create"],
    activity: ["create", "update", "delete"],
});

export const systemAdmin = ac.newRole({
    project: ["create", "update", "delete", "share"],
    organization: ["create", "update", "delete", "share"],
    member: ["create", "update", "delete"],
    invitation: ["create", "cancel"],
});
