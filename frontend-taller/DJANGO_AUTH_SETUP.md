# Django Auth — Endpoints requeridos por TallerOS

El frontend envía `Authorization: Token <token>` en **cada** request a `/api/*`.
Sin este token Django debe responder **401** (no 200 con datos de otro usuario).

---

## 1. Instalar dependencias

```bash
pip install djangorestframework
```

## 2. settings.py

```python
INSTALLED_APPS = [
    ...
    'rest_framework',
    'rest_framework.authtoken',
]

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.TokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',  # TODAS las views requieren token
    ],
}
```

## 3. Modelo Taller (si no existe)

```python
# models.py
from django.contrib.auth.models import AbstractUser
from django.db import models

class Usuario(AbstractUser):
    pass

class Taller(models.Model):
    owner     = models.OneToOneField(Usuario, on_delete=models.CASCADE, related_name='taller')
    nombre    = models.CharField(max_length=200)
    ciudad    = models.CharField(max_length=100, blank=True)
    telefono  = models.CharField(max_length=20, blank=True)
    trial_start = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.nombre
```

Todos los modelos existentes (Cliente, Vehiculo, Trabajo, etc.) deben tener FK a Taller:
```python
class Cliente(models.Model):
    taller = models.ForeignKey(Taller, on_delete=models.CASCADE, related_name='clientes')
    # ... resto de campos
```

## 4. Views de Auth

```python
# auth_views.py
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from .models import Usuario, Taller

@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    email    = request.data.get('email', '').lower()
    password = request.data.get('password', '')
    user = authenticate(request, username=email, password=password)
    if not user:
        return Response({'detail': 'Email o contraseña incorrectos.'}, status=400)
    token, _ = Token.objects.get_or_create(user=user)
    taller   = getattr(user, 'taller', None)
    return Response({
        'token':        token.key,
        'user_id':      user.id,
        'email':        user.email,
        'nombre':       user.get_full_name() or user.username,
        'taller_nombre': taller.nombre if taller else '',
        'taller_id':    taller.id if taller else None,
        'trial_start':  taller.trial_start.isoformat() if taller else None,
    })

@api_view(['POST'])
@permission_classes([AllowAny])
def register_view(request):
    email    = request.data.get('email', '').lower()
    password = request.data.get('password', '')
    nombre   = request.data.get('nombre', '')
    taller_nombre = request.data.get('taller_nombre', '')
    ciudad   = request.data.get('taller_ciudad', '')
    tel      = request.data.get('taller_tel', '')

    if Usuario.objects.filter(username=email).exists():
        return Response({'email': ['Ya existe una cuenta con ese email.']}, status=400)

    user = Usuario.objects.create_user(
        username=email, email=email, password=password,
        first_name=nombre.split(' ')[0],
        last_name=' '.join(nombre.split(' ')[1:]),
    )
    taller = Taller.objects.create(owner=user, nombre=taller_nombre, ciudad=ciudad, telefono=tel)
    token, _ = Token.objects.get_or_create(user=user)

    return Response({
        'token':         token.key,
        'user_id':       user.id,
        'email':         user.email,
        'nombre':        nombre,
        'taller_nombre': taller.nombre,
        'taller_id':     taller.id,
        'trial_start':   taller.trial_start.isoformat(),
    }, status=201)
```

## 5. urls.py

```python
from django.urls import path
from . import auth_views

urlpatterns = [
    path('auth/login/',    auth_views.login_view,    name='auth-login'),
    path('auth/register/', auth_views.register_view, name='auth-register'),
    # ... resto de rutas
]
```

## 6. Filtrar QuerySets por taller (CRÍTICO para aislar datos)

En CADA ViewSet o APIView que devuelva datos:

```python
class ClienteViewSet(viewsets.ModelViewSet):
    serializer_class = ClienteSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Solo los clientes del taller del usuario logueado
        return Cliente.objects.filter(taller=self.request.user.taller)

    def perform_create(self, serializer):
        serializer.save(taller=self.request.user.taller)
```

Repetir `get_queryset` con `filter(taller=self.request.user.taller)` en:
- ClienteViewSet
- VehiculoViewSet
- TrabajoViewSet
- PresupuestoViewSet
- MovimientoCajaViewSet
- TurnoViewSet
- GastoViewSet

## 7. Verificar que funciona

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'
# Debe devolver: {"token": "abc123...", "user_id": 1, ...}

# Endpoint protegido sin token — debe dar 401
curl http://localhost:8000/api/clientes/
# {"detail": "Authentication credentials were not provided."}

# Con token — solo datos del taller del usuario
curl http://localhost:8000/api/clientes/ \
  -H "Authorization: Token abc123..."
# [{"id": 1, "nombre_completo": "...", ...}]  ← solo los suyos
```
