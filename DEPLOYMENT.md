# Registrar System Deployment Guide

## Quick Deployment

### Prerequisites
- Docker Desktop installed
- At least 4GB RAM available

### Steps to Deploy

1. **Extract or clone the system**
```bash
# If using the archive
tar -xzf registrar-system.tar.gz
cd registrarmain

# Or if cloning from git
git clone <repository-url>
cd registrarmain
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Start the system**
```bash
docker compose up -d
```

4. **Access the application**
- Main application: http://localhost:80
- Backend API: http://localhost:8000
- Database: localhost:3306

### Production Deployment

For production environments:

1. **Update .env for production**
```bash
DJANGO_DEBUG=False
DJANGO_ALLOWED_HOSTS=your-domain.com
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

2. **Use production secrets**
- Generate strong Django secret key
- Use secure database passwords
- Configure SSL certificates

3. **Start production containers**
```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Maintenance Commands

- **View logs**: `docker compose logs -f`
- **Stop services**: `docker compose down`
- **Update system**: `git pull && docker compose up -d --build`
- **Database backup**: `docker compose exec db mysqldump -u root -p enrollment_system > backup.sql`

### Troubleshooting

- **Port conflicts**: Change ports in docker-compose.yml
- **Permission issues**: Run Docker as administrator
- **Memory issues**: Increase Docker memory allocation

## Architecture

- **Frontend**: React + TypeScript (port 80)
- **Backend**: Django REST API (port 8000)
- **Database**: MySQL 8 (port 3306)
- **Cache**: Redis (port 6379)
