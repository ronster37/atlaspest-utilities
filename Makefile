.PHONY: build run stop clean help

help:
	@echo "Available commands:"
	@awk -F ':|##' '/^[a-zA-Z0-9_-]+:.*?##/ { printf "  %-30s %s\n", $$1, $$NF }' $(MAKEFILE_LIST)

build: ## Build Docker images
	docker compose build

run: ## Start the PostgreSQL container
	docker compose up

stop: ## Stop the PostgreSQL container
	docker compose down

clean: stop ## Stop and remove the PostgreSQL container
	docker-compose rm -f

