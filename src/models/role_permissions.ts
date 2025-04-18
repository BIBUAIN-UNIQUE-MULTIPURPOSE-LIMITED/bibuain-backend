import { Entity, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Role } from "./roles";
import { Permission } from "./permissions";

@Entity("role_permissions")
export class RolePermission {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "role_id" })
  role!: Role;

  @ManyToOne(() => Permission, (permission) => permission.rolePermissions, {
    onDelete: "CASCADE",
  })
  @JoinColumn({ name: "permission_id" })
  permission!: Permission;
}
