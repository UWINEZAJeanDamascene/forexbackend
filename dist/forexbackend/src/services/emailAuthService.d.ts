export declare function requestEmailLogin(emailInput: string): Promise<void>;
export declare function verifyEmailLogin(token: string, anonymousUserId: string): Promise<string | null>;
