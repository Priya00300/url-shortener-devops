# URL Shortener - Cloud-Native DevOps Project

A complete microservices-based URL shortener with automated CI/CD pipeline, containerization, and Kubernetes orchestration.

![Build Status](https://github.com/priiya03/url-shortener-devops/workflows/CI/CD%20Pipeline/badge.svg)

## 🎯 Project Overview

This project demonstrates enterprise-level DevOps practices by building a production-ready URL shortener application with:
- **Microservices Architecture**: Redirector and Analytics services
- **Containerization**: Docker multi-stage builds
- **Orchestration**: Kubernetes with k3d
- **CI/CD**: Automated GitHub Actions pipeline
- **Database**: MongoDB with Helm charts
- **Monitoring**: Health checks and logging

## 🏗️ Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ↓
┌──────────────────────────────────────┐
│     Kubernetes Cluster (k3d)         │
│  ┌────────────────────────────────┐  │
│  │   Redirector Service (2 pods)  │  │
│  │   Port: 3001                   │  │
│  └───────┬────────────────────────┘  │
│          │                            │
│          ↓                            │
│  ┌────────────────────────────────┐  │
│  │   Analytics Service (2 pods)   │  │
│  │   Port: 3002                   │  │
│  └───────┬────────────────────────┘  │
│          │                            │
│          ↓                            │
│  ┌────────────────────────────────┐  │
│  │   MongoDB (StatefulSet)        │  │
│  │   Port: 27017                  │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

## 🛠️ Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Application** | Node.js, Express.js | Backend microservices |
| **Database** | MongoDB | Data persistence |
| **Containerization** | Docker | Application packaging |
| **Orchestration** | Kubernetes (k3d) | Container management |
| **CI/CD** | GitHub Actions | Automated pipeline |
| **Package Manager** | Helm | Kubernetes package management |
| **Container Registry** | Docker Hub | Image storage |
| **Testing** | Jest, Supertest | Unit & integration tests |

## 📁 Project Structure

```
url-shortener-devops/
├── .github/
│   └── workflows/
│       └── ci-cd.yml                 # CI/CD pipeline
├── redirector-service/
│   ├── src/
│   │   ├── controllers/              # Business logic
│   │   ├── models/                   # Database schemas
│   │   ├── routes/                   # API routes
│   │   ├── middleware/               # Validation
│   │   ├── services/                 # External service clients
│   │   └── utils/                    # Utilities
│   ├── tests/                        # Test suites
│   ├── Dockerfile                    # Container definition
│   ├── package.json
│   └── server.js                     # Entry point
├── analytics-service/
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   └── middleware/
│   ├── tests/
│   ├── Dockerfile
│   ├── package.json
│   └── server.js
├── k8s/
│   ├── namespace.yaml                # Kubernetes namespace
│   ├── configmap.yaml                # Configuration
│   ├── mongodb-values.yaml           # MongoDB Helm values
│   ├── analytics-deployment.yaml     # Analytics K8s resources
│   └── redirector-deployment.yaml    # Redirector K8s resources
├── docker-compose.yml                # Local development
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker Desktop
- kubectl
- k3d
- Helm
- Git

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/priiya03/url-shortener-devops.git
cd url-shortener-devops
```

2. **Start services with Docker Compose**
```bash
docker-compose up -d
```

3. **Test the application**
```bash
# Create short URL
curl -X POST http://localhost:3001/api/shorten \
  -H "Content-Type: application/json" \
  -d '{"originalUrl":"https://github.com"}'

# Access short URL (redirects)
curl -L http://localhost:3001/api/{shortCode}

# Get analytics
curl http://localhost:3002/api/analytics/{shortCode}
```

### Kubernetes Deployment

1. **Create k3d cluster**
```bash
k3d cluster create url-shortener \
  --api-port 127.0.0.1:6443 \
  --port "8080:80@loadbalancer" \
  --agents 2
```

2. **Install MongoDB**
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install mongodb bitnami/mongodb \
  --namespace url-shortener \
  --create-namespace \
  --values k8s/mongodb-values.yaml
```

3. **Create secrets**
```bash
kubectl create secret generic mongodb-secret \
  --from-literal=mongodb-uri='mongodb://mongodb:27017/urlshortener' \
  --namespace url-shortener
```

4. **Deploy services**
```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/analytics-deployment.yaml
kubectl apply -f k8s/redirector-deployment.yaml
```

5. **Verify deployment**
```bash
kubectl get all -n url-shortener
```

6. **Access the application**
```bash
http://localhost:8080
```

## 📊 API Documentation

### Redirector Service (Port 3001/8080)

#### Create Short URL
```http
POST /api/shorten
Content-Type: application/json

{
  "originalUrl": "https://example.com/very/long/url",
  "customAlias": "my-link",  // optional
  "expiresInDays": 30        // optional
}
```

#### Redirect to Original URL
```http
GET /api/{shortCode}
```

#### Get URL Information
```http
GET /api/info/{shortCode}
```

### Analytics Service (Port 3002)

#### Get Analytics
```http
GET /api/analytics/{shortCode}
```

#### Get Top URLs
```http
GET /api/analytics/top?limit=10&period=week
```

## 🔄 CI/CD Pipeline

The automated pipeline runs on every push to main:

1. **Test** - Run unit and integration tests
2. **Build** - Create Docker images
3. **Push** - Upload to Docker Hub
4. **Deploy** - Update Kubernetes deployments (optional)

### Pipeline Status
![CI/CD](https://github.com/priiya03/url-shortener-devops/workflows/CI/CD%20Pipeline/badge.svg)

## 🧪 Testing

```bash
# Run tests for redirector service
cd redirector-service
npm test

# Run tests for analytics service
cd analytics-service
npm test

# Run with coverage
npm test -- --coverage
```

## 📈 Monitoring

### Health Checks

```bash
# Redirector health
curl http://localhost:8080/health

# Analytics health  
kubectl port-forward svc/analytics-service 3002:3002 -n url-shortener
curl http://localhost:3002/health
```

### Logs

```bash
# View all logs
kubectl logs -f -l app=redirector-service -n url-shortener

# View specific pod
kubectl logs -f <pod-name> -n url-shortener
```

## 🔧 Configuration

### Environment Variables

**Redirector Service:**
- `NODE_ENV` - Environment (development/production)
- `PORT` - Service port (default: 3001)
- `MONGODB_URI` - MongoDB connection string
- `ANALYTICS_SERVICE_URL` - Analytics service endpoint
- `BASE_URL` - Base URL for short links

**Analytics Service:**
- `NODE_ENV` - Environment
- `PORT` - Service port (default: 3002)
- `MONGODB_URI` - MongoDB connection string

## 🎓 Key Learning Outcomes

This project demonstrates:
- ✅ Microservices architecture design
- ✅ RESTful API development
- ✅ Docker containerization best practices
- ✅ Kubernetes deployment and management
- ✅ CI/CD pipeline automation
- ✅ Infrastructure as Code
- ✅ Service mesh communication
- ✅ Database integration
- ✅ Health checks and monitoring
- ✅ Git workflow and version control

## 📝 Future Enhancements

- [ ] Add Redis caching layer
- [ ] Implement rate limiting
- [ ] Add Prometheus monitoring
- [ ] Set up Grafana dashboards
- [ ] Implement JWT authentication
- [ ] Add API Gateway (Nginx/Traefik)
- [ ] Deploy to cloud (AWS/GCP/Azure)
- [ ] Add end-to-end tests
- [ ] Implement blue-green deployment
- [ ] Add service mesh (Istio)

## 👤 Author

**Priiya**
- GitHub: [@Priya00300](https://github.com/Priya00300)
- Docker Hub: [priiya03](https://hub.docker.com/u/priiya03)

