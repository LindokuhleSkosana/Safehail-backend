export interface RegisterInput {
  phone: string;
  password: string;
  email?: string;
}

export interface VerifyOtpInput {
  phone: string;
  otp: string;
}

export interface LoginInput {
  phone: string;
  password: string;
}

export interface RefreshInput {
  refreshToken: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface OtpRecord {
  code: string;
  expiresAt: number;
  userId: string;
}
