#!/bin/bash

set -e

if [ "$NODE_ENV" == 'development' ]; then
    npx prisma migrate dev
elif [ "$NODE_ENV" == 'production' ]; then
    npx prisma migrate deploy
else
    true
fi
