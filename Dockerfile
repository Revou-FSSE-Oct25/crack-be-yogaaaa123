FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency manifests first for better cache utilization
COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including dev) for build
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy source code
COPY . .

# Build the application
RUN npm run build


# --- Stage 2: Production ---
FROM node:22-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy dependency manifests and prisma config
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./

RUN npm ci --omit=dev


RUN npx prisma generate

COPY --from=builder /app/dist ./dist

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3000
CMD ["npm", "run", "start:migrate"]
