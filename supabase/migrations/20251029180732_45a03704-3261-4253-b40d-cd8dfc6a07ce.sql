-- Actualizar suscripción del cliente a Inversor Premium
UPDATE clientes 
SET tipo_suscripcion = 'investor_platino'
WHERE email = 'cliente@cliente.com';