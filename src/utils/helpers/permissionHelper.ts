import { auth } from "../auth";

export async function hasPermission(authHeaders: Headers, resource: string, action: string): Promise<boolean> {
    const permissionResult = await auth.api.hasPermission({
        headers: authHeaders,
        body: {
            permissions: {
                [resource]: [action]
            },
        },
    });
    
    return permissionResult.success;
}