from rest_framework import serializers

from .models import Product


class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ["id", "product_name", "description", "extra_data", "is_deleted", "created_at", "updated_at"]
        read_only_fields = ["is_deleted", "created_at", "updated_at"]

