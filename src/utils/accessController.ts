import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
    project: ["create", "share", "update", "delete"], // <-- Permissions available for created roles
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

export const admin = ac.newRole({ 
    project: ["create", "update", "delete", "share"], 
}); 