# --- 공통 베이스 (의존성 설치) ---
FROM node:22-alpine AS base

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- 개발용: 소스는 볼륨 마운트로 주입 ---
FROM base AS dev
CMD ["npm", "run", "dev"]

# --- 프로덕션 빌드: NEXT_PUBLIC_* 변수는 빌드 타임에 번들에 embed됨 ---
FROM base AS builder

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_WS_URL

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .
RUN npm run build

# --- 프로덕션 실행: 빌드 결과물만 포함 ---
FROM node:22-alpine AS prod

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY package.json ./

EXPOSE 3400
CMD ["npm", "start"]
