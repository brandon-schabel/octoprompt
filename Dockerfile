# ---- Base Stage ----
# This stage installs dependencies and copies source code.
# It's used as a base for subsequent build stages.
FROM oven/bun:1 as base
WORKDIR /app

# Copy configuration files and package manifests first to leverage Docker cache for dependencies.
# Essential files for 'bun install' and subsequent build steps.
COPY package.json bun.lockb ./
# COPY tsconfig.json ./ # Or any other root config files like .env, etc. if needed by build

# Ensure target directories for workspace package.json files exist before copying.
RUN mkdir -p packages/client packages/server packages/shared

COPY packages/client/package.json ./packages/client/
COPY packages/server/package.json ./packages/server/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies for the monorepo.
# Using --frozen-lockfile is recommended for reproducible builds if bun.lockb is committed and up-to-date.
RUN bun install --frozen-lockfile

# Copy the rest of the monorepo source code.
# This includes all files from packages/, scripts/, etc.
COPY . .


# ---- Client Build Stage ----
# This stage builds the client-side application.
FROM base as client-builder
WORKDIR /app

# IMPORTANT NOTE on OpenAPI client generation:
# The OctoPrompt README mentions that 'bun run openapi-ts' (which generates client-side API typings)
# requires the server to be running. This step is problematic for a static Docker build process.
#
# OPTION 1 (Recommended): Commit the generated files (typically in packages/client/src/generated)
# to your version control. If these files are committed and up-to-date, you can safely comment out
# or remove the 'RUN bun run openapi-ts' line below.
#
# OPTION 2: If generation during build is mandatory and server is needed, the Dockerfile would
# need a more complex setup to run the server temporarily, which is beyond this standard build.
#
# RUN bun run openapi-ts:prod

# Build the client application.
# According to the README and typical Vite setups, the client build output
# (from packages/client/vite.config.ts) is placed in packages/server/client-dist.
RUN cd packages/client && bun run build


# ---- Server Build Stage ----
# This stage builds the server application and prepares all production artifacts.
FROM base as server-builder
WORKDIR /app

# Copy client build artifacts from the client-builder stage.
# These artifacts are located at /app/packages/server/client-dist in the client-builder stage.
COPY --from=client-builder /app/packages/server/client-dist ./packages/server/client-dist

# Create the final distribution directory structure that will be copied to the production image.
RUN mkdir -p /app/dist_final/client-dist # For client assets
RUN mkdir -p /app/dist_final/prompts    # For server prompts
RUN mkdir -p /app/dist_final/data       # For server data (e.g., JSON files)

# Build the server bundle from packages/server/server.ts.
# The output (server.js) will be placed in /app/dist_final/.
RUN bun build ./packages/server/server.ts --outdir /app/dist_final --target bun --minify --sourcemap=none

# Copy the built client assets (from /app/packages/server/client-dist)
# into the final distribution directory's client-dist folder.
RUN cp -r ./packages/server/client-dist/* /app/dist_final/client-dist/

# Copy the server's prompts folder (from /app/packages/server/prompts)
# into the final distribution directory's prompts folder.
RUN cp -r ./packages/server/prompts/* /app/dist_final/prompts/

# Copy the server's data folder contents (from /app/packages/server/data)
# into the final distribution directory's data folder.
RUN cp -a ./packages/server/data/. /app/dist_final/data/


# Create a minimal package.json for the runtime stage.
# This defines the 'start' script necessary to run the server.
RUN echo '{ \
  "name": "octoprompt-server-runtime", \
  "version": "0.5.1", \
  "type": "module", \
  "scripts": { "start": "bun ./server.js" } \
}' > /app/dist_final/package.json


# ---- Production Stage ----
# This stage creates the final, lean production image.
FROM oven/bun:1-slim as production
WORKDIR /app

# Copy all prepared artifacts (server bundle, client assets, prompts, database, and runtime package.json)
# from the server-builder stage's /app/dist_final directory into the production image.
COPY --from=server-builder /app/dist_final .

# Designate /app/data as a volume for persistent storage of JSON files
VOLUME /app/data

# Expose the production port the server listens on.
EXPOSE 3579

# Set the default user for running the application (optional, but a good security practice).
# Ensure this user has permissions to read/write to any necessary paths (e.g., the database file if it's modified at runtime).
# USER bun

# Define the command to run the server using the 'start' script in the copied package.json.
CMD ["bun", "run", "start"]