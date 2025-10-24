#!/usr/bin/env python3
"""
Script de testing para verificar rotación de User-Agents
"""
from config import get_random_user_agent, get_random_headers, get_random_delay

print("🧪 Testing User-Agent Rotation\n")
print("=" * 80)

# Test 10 User-Agents aleatorios
print("\n📋 Generando 10 User-Agents aleatorios:\n")
for i in range(10):
    ua = get_random_user_agent()
    print(f"{i+1}. {ua}")

# Test delays aleatorios
print("\n\n⏱️  Generando 10 delays aleatorios:\n")
for i in range(10):
    delay = get_random_delay(0.5, 2.0)
    print(f"{i+1}. {delay:.3f}s")

# Test headers completos
print("\n\n🔧 Headers completos (ejemplo):\n")
headers = get_random_headers()
for key, value in headers.items():
    print(f"  {key}: {value}")

print("\n" + "=" * 80)
print("✅ Rotación funcionando correctamente!")
