import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from "typeorm";
import { RolePermission } from "./role_permissions";

@Entity("permissions")
export class Permission {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "varchar", length: 100, unique: true })
  permissionName!: string;

  @Column({ type: "varchar", length: 50 })
  module!: string;

  @CreateDateColumn({ type: "timestamp" })
  createdAt!: Date;

  @OneToMany(
    () => RolePermission,
    (rolePermission) => rolePermission.permission
  )
  rolePermissions!: RolePermission[];
}
