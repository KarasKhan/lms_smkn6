import os

def write_tree(dir_path, prefix, ignore_list, output_file):
    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return
    
    entries = [e for e in entries if e not in ignore_list]
    entries_count = len(entries)

    for i, entry in enumerate(entries):
        path = os.path.join(dir_path, entry)
        is_last = i == (entries_count - 1)
        
        connector = "└── " if is_last else "├── "
        line = prefix + connector + entry
        
        print(line)
        output_file.write(line + "\n")
            
        if os.path.isdir(path):
            extension = "    " if is_last else "│   "
            write_tree(path, prefix + extension, ignore_list, output_file)

def write_contents(dir_path, ignore_list, allowed_extensions, output_file):
    try:
        entries = sorted(os.listdir(dir_path))
    except PermissionError:
        return

    entries = [e for e in entries if e not in ignore_list]
    
    for entry in entries:
        path = os.path.join(dir_path, entry)
        
        if os.path.isdir(path):
            write_contents(path, ignore_list, allowed_extensions, output_file)
        else:
            _, ext = os.path.splitext(entry)
            if ext in allowed_extensions:
                relative_path = os.path.relpath(path, ".")
                
                # Membuat header pembatas antar file yang jelas
                separator = f"\n\n{'='*60}\n📄 FILE: {relative_path}\n{'='*60}\n"
                output_file.write(separator)
                
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        content = f.read()
                        output_file.write(content)
                except Exception as e:
                    output_file.write(f"// Gagal membaca file: {str(e)}\n")

if __name__ == "__main__":
    output_filename = "struktur_project.txt"
    current_script = os.path.basename(__file__)
    
    # Daftar folder dan file bawaan yang diabaikan agar file dump tidak bising
    ignore_files = {
        '.git', 'node_modules', '.vscode', '__pycache__', 'dist', 
        '.DS_Store', 'package-lock.json', output_filename, current_script
    }
    
    # Hanya ekstensi file ini yang akan diambil isi kodenya
    allowed_exts = {'.vue', '.js', '.css', '.html', '.json'}
    
    print(f"Memindai struktur dan menyalin isi kode proyek lms_smkn6...\n")
    
    with open(output_filename, "w", encoding="utf-8") as f:
        # 1. Tulis Struktur Folder terlebih dahulu
        f.write("[STRUKTUR FOLDER PROJECT lms_smkn6]\n.\n")
        print(".")
        write_tree(".", "", ignore_files, f)
        
        # 2. Tulis Isi Kode Sumber
        f.write("\n" + "="*60 + "\n")
        f.write("[ISI KODE SUMBER FILE SOURCE CODE]\n")
        f.write("="*60 + "\n")
        
        write_contents(".", ignore_files, allowed_exts, f)
        
    print(f"\n✅ Selesai! Struktur dan seluruh isi kode telah disimpan di '{output_filename}'")
    print("Salin seluruh isi file tersebut bersama dengan Context Prompt saat memulai sesi baru.")