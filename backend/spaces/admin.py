from django.contrib import admin

from .models import Invitation, Membership, Space


class MembershipInline(admin.TabularInline):
    model = Membership
    extra = 0


@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "currency", "created_by", "created_at"]
    list_filter = ["kind"]
    search_fields = ["name", "memberships__user__username"]
    inlines = [MembershipInline]


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["phone", "space", "inviter", "status", "created_at"]
    list_filter = ["status"]
