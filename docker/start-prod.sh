#!/bin/sh
set -e

npm run migrate:prod
npm run seed:prod
npm run start
