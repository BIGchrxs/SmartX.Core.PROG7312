# Build the dashboard with Node, then serve the built files with nginx. Node is only needed to
# compile the TypeScript and bundle the assets, so it is left behind in the build stage.

FROM node:22-alpine AS build
WORKDIR /src

# The lock file is copied with package.json so npm ci installs the exact versions this project
# was built and tested against, rather than whatever is newest on the day of the build.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html

EXPOSE 80
