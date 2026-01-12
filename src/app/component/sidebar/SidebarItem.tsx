"use client";

import React, { useState, useRef, useEffect } from "react";
import { MoreVertical, Pencil, Trash2, Check, X } from "lucide-react";
import { useRouter, usePathname } from "next/navigation";
import { renameCanvas, deleteCanvas } from "@/app/actions/canvas";

interface CanvasItem {
  id: string;
  title: string | null;
  createdAt: Date;
}

interface SidebarItemProps {
  canvas: CanvasItem;
  formatDateTitle: (date: Date | string) => string;
  onUpdate: () => void;
}

export default function SidebarItem({ canvas, formatDateTitle, onUpdate }: SidebarItemProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isActive = pathname === `/canvas/${canvas.id}`;

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(canvas.title || "");
  const [isDeleting, setIsDeleting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto focus input
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleRename = async () => {
    if (!editTitle.trim()) return;
    try {
      await renameCanvas(canvas.id, editTitle);
      setIsEditing(false);
      setIsMenuOpen(false);
      onUpdate(); // Refresh list
    } catch (error) {
      console.error("Failed to rename:", error);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteCanvas(canvas.id);
      onUpdate();
      if (isActive) router.push("/");
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  if (isDeleting) {
    return (
      <li className="px-4 py-2">
        <div className="bg-red-50 border border-red-100 rounded-md p-2 text-sm">
          <p className="text-red-800 mb-2 font-medium">Delete this canvas?</p>
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              className="flex-1 bg-red-600 text-white py-1 rounded hover:bg-red-700 text-xs"
            >
              Confirm
            </button>
            <button
              onClick={() => { setIsDeleting(false); setIsMenuOpen(false); }}
              className="flex-1 bg-gray-200 text-gray-700 py-1 rounded hover:bg-gray-300 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="relative group">
      <div
        className={`flex items-center justify-between w-full text-left px-4 py-2 text-sm transition-colors cursor-pointer ${
          isActive ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"
        }`}
        onClick={() => {
            if (!isEditing && !isMenuOpen) router.push(`/canvas/${canvas.id}`);
        }}
      >
        {isEditing ? (
          <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRename();
                if (e.key === "Escape") setIsEditing(false);
              }}
              className="flex-1 min-w-0 bg-white border border-blue-300 rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button onClick={handleRename} className="text-green-600 hover:bg-green-100 p-0.5 rounded">
              <Check size={14} />
            </button>
            <button onClick={() => setIsEditing(false)} className="text-red-500 hover:bg-red-100 p-0.5 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <>
            <span className="truncate flex-1">
              {canvas.title || formatDateTitle(canvas.createdAt)}
            </span>
            
            {/* Menu Trigger */}
            <div className="relative" ref={menuRef} onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-opacity ${
                    isMenuOpen ? 'opacity-100 bg-gray-200' : 'opacity-0 group-hover:opacity-100'
                }`}
              >
                <MoreVertical size={16} />
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-gray-100 z-50 overflow-hidden">
                  <button
                    onClick={() => {
                        setEditTitle(canvas.title || formatDateTitle(canvas.createdAt));
                        setIsEditing(true);
                        setIsMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Pencil size={12} /> Rename
                  </button>
                  <button
                    onClick={() => {
                        setIsDeleting(true);
                        // Don't close menu immediately, switch to confirm UI
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </li>
  );
}
