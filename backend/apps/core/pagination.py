from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    """Same default page size as before, but lets a client ask for more in
    one page via ?page_size=100 — needed by frontend comboboxes (client's
    company picker, costing's supplier/product/client pickers, etc.) that
    want every option rather than the first 20."""

    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 200
