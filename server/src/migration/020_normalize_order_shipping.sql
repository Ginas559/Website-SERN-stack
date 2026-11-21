UPDATE dbo.orders
SET ghn_info = JSON_MODIFY(ghn_info, '$.deliveryType', 'INTERNAL'),
    updatedAt = GETDATE()
WHERE ISJSON(NULLIF(LTRIM(RTRIM(ghn_info)), '')) = 1
  AND JSON_VALUE(ghn_info, '$.deliveryType') = 'INNER_CITY';

UPDATE orders
SET ghn_info = normalized.info,
    updatedAt = GETDATE()
FROM dbo.orders AS orders
CROSS APPLY (VALUES (
    JSON_MODIFY(
        orders.ghn_info,
        '$.receiverName',
        COALESCE(
            JSON_VALUE(orders.ghn_info, '$.receiverName'),
            JSON_VALUE(orders.ghn_info, '$.recipientName'),
            JSON_VALUE(orders.ghn_info, '$.fullName')
        )
    )
)) AS receiver(normalized)
CROSS APPLY (VALUES (
    JSON_MODIFY(
        receiver.normalized,
        '$.phone',
        COALESCE(
            JSON_VALUE(orders.ghn_info, '$.phone'),
            JSON_VALUE(orders.ghn_info, '$.phoneNumber'),
            JSON_VALUE(orders.ghn_info, '$.recipientPhone')
        )
    )
)) AS phone(normalized)
CROSS APPLY (VALUES (
    JSON_MODIFY(
        phone.normalized,
        '$.address',
        COALESCE(
            JSON_VALUE(orders.ghn_info, '$.address'),
            JSON_VALUE(orders.ghn_info, '$.shippingAddress')
        )
    )
)) AS address(normalized)
CROSS APPLY (VALUES (
    JSON_MODIFY(
        JSON_MODIFY(
            JSON_MODIFY(
                JSON_MODIFY(
                    JSON_MODIFY(address.normalized, '$.recipientName', NULL),
                    '$.fullName',
                    NULL
                ),
                '$.phoneNumber',
                NULL
            ),
            '$.recipientPhone',
            NULL
        ),
        '$.shippingAddress',
        NULL
    )
)) AS normalized(info)
WHERE ISJSON(NULLIF(LTRIM(RTRIM(orders.ghn_info)), '')) = 1
  AND (
      JSON_VALUE(orders.ghn_info, '$.recipientName') IS NOT NULL
      OR JSON_VALUE(orders.ghn_info, '$.fullName') IS NOT NULL
      OR JSON_VALUE(orders.ghn_info, '$.phoneNumber') IS NOT NULL
      OR JSON_VALUE(orders.ghn_info, '$.recipientPhone') IS NOT NULL
      OR JSON_VALUE(orders.ghn_info, '$.shippingAddress') IS NOT NULL
  );
