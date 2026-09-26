FROM oven/bun:1.3.10-alpine

WORKDIR /app

# Installer kun de nødvendige afhængigheder for at køre applikationen,
# det he lag vil forblive cahced, så det ikke skal geninstalleres ved hver build.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --chown=bun:bun src ./src
COPY --chown=bun:bun drizzle ./drizzle
COPY --chown=bun:bun drizzle.config.ts tsconfig.json ./

ENV NODE_ENV=production
ENV PORT=3020

USER bun
EXPOSE 3020

CMD ["bun", "run", "start"]
