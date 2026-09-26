# SeniorSync backend

Backenden til SeniorSync. Den står for API'et, autentifikation, adgangskontrol,
data i PostgreSQL og forbindelsen til faldesensorer via MQTT.

Projektet er skrevet i TypeScript og kører med [Bun](https://bun.sh/). API'et er
bygget med Hono, databasen håndteres med Drizzle ORM, og Better Auth bruges til
login og sessioner.

## Forudsætninger

For at køre projektet lokalt skal du have følgende klar:

- [Bun](https://bun.sh/) installeret
- Adgang til projektets Doppler-projekt
- Adgang til PostgreSQL-databasen og MQTT-brokeren via de secrets, Doppler leverer

## Kom godt i gang

Installer afhængighederne:

```sh
bun install
```

Opret en lokal `.env`-fil med udgangspunkt i `.env.example`:

```env
DOPPLER_TOKEN=din_doppler_token
DOPPLER_PROJECT=backend
DOPPLER_CONFIG=dev
```

Start derefter udviklingsserveren:

```sh
bun run dev
```

Ved opstart henter applikationen resten af sin konfiguration fra Doppler. Det
gælder blandt andet databaseforbindelse, Better Auth, MitID, MQTT og Cloudflare.
Secrets må ikke lægges i repository'et.

## Database

Databasens schema og migrationer ligger i henholdsvis `src/db/schemas` og
`drizzle`. Kommandoerne herunder køres med den `DATABASE_URL`, som er hentet fra
Doppler.

```sh
# Opret en migration efter ændringer i schemaet
bun run db:generate

# Kør eksisterende migrationer
bun run db:migrate

# Indlæs test- eller grunddata
bun run db:seed
```

Hvis Better Auths schema ændres, genereres det med:

```sh
bun run auth:generate
```

## API og integrationer

API'et indeholder blandt andet endpoints for aktiviteter, faciliteter, besøg,
borgere, pårørende, sensorer og skærmbesøg. Login håndteres på
`/api/auth/*`.

Ved opstart oprettes også en MQTT-forbindelse. Backend lytter på emnerne
`seniorsync/fallsensor/status/#` og `seniorsync/fallsensor/fall/#` for at
behandle status- og faldhændelser fra sensorer.

## Docker

Der følger en Dockerfile med til deployment. Byg imaget fra projektmappen:

```sh
docker build -t seniorsync-backend .
```

Start containeren med Doppler-konfigurationen som miljøvariabler:

```sh
docker run --rm -p 3000:3000 --env-file .env seniorsync-backend
```

I vores produktionsmiljø sættes `DOPPLER_TOKEN`, `DOPPLER_PROJECT` og
`DOPPLER_CONFIG` i hostingplatformens miljøvariabler. Brug en produktionsconfig
i Doppler i stedet for den lokale `dev`-config.

## NPM-scripts

| Kommando | Formål |
| --- | --- |
| `bun run dev` | Starter backend med hot reload. |
| `bun run start` | Starter backend uden hot reload. |
| `bun run db:generate` | Genererer en Drizzle-migration. |
| `bun run db:migrate` | Kører database-migrationer. |
| `bun run db:seed` | Seeder databasen. |
| `bun run auth:generate` | Genererer Better Auth-schemaet. |
