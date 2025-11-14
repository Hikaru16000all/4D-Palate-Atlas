import pandas as pd
import numpy as np
import os
import json
import struct
from tqdm import tqdm

class BaseDataConverter:
    def __init__(self, base_path='/home/ug1128u9/ST-RNA-ATAC_Palate/web/spatial-visualizer/public/data'):
        self.base_path = base_path
        self.binary_path = os.path.join(base_path, 'binary')
        
    def convert_all_base_data(self):
        """转换所有基础数据"""
        print("转换基础数据...")
        
        # 确保目录存在
        os.makedirs(os.path.join(self.binary_path, 'base'), exist_ok=True)
        os.makedirs(os.path.join(self.binary_path, 'tfs'), exist_ok=True)
        
        # 转换基础CSV文件
        cell_id_to_index = self._convert_base_csv_data()
        
        # 转换TF活性数据（如果有）
        tf_metadata = self._convert_tf_activity(cell_id_to_index)
        
        # 创建完整元数据
        self._create_complete_metadata(tf_metadata, len(cell_id_to_index))
        
        print("基础数据转换完成！")
    
    def _convert_base_csv_data(self):
        """转换基础CSV文件"""
        print("读取基础CSV文件...")
        
        # 读取基础CSV文件
        coordinates = pd.read_csv(os.path.join(self.base_path, 'coordinates.csv'))
        sections = pd.read_csv(os.path.join(self.base_path, 'section.csv'))
        celltypes = pd.read_csv(os.path.join(self.base_path, 'celltype.csv'))
        
        # 打印列名以便调试
        print(f"坐标文件列名: {coordinates.columns.tolist()}")
        print(f"切片文件列名: {sections.columns.tolist()}")
        print(f"细胞类型文件列名: {celltypes.columns.tolist()}")
        
        # 获取第一列的名称（细胞ID列）
        coord_first_col = coordinates.columns[0]
        section_first_col = sections.columns[0]
        celltype_first_col = celltypes.columns[0]
        
        # 获取第二列的名称（数据列）
        section_second_col = sections.columns[1]
        celltype_second_col = celltypes.columns[1]
        
        # 创建细胞ID映射
        cell_ids = coordinates[coord_first_col].values
        cell_id_to_index = {str(cell_id): idx for idx, cell_id in enumerate(cell_ids)}
        
        print(f"找到 {len(cell_ids)} 个细胞")
        
        # 保存细胞ID
        with open(os.path.join(self.binary_path, 'base', 'cell_ids.bin'), 'wb') as f:
            f.write(struct.pack('I', len(cell_ids)))
            for cell_id in cell_ids:
                cell_bytes = str(cell_id).encode('utf-8')
                f.write(struct.pack('I', len(cell_bytes)))
                f.write(cell_bytes)
        
        # 保存坐标数据
        if 'x' in coordinates.columns and 'y' in coordinates.columns:
            coords = coordinates[['x', 'y']].values.astype(np.float32)
        else:
            coords = coordinates.iloc[:, 1:3].values.astype(np.float32)
            
        with open(os.path.join(self.binary_path, 'base', 'coordinates.bin'), 'wb') as f:
            f.write(struct.pack('I', coords.shape[0]))
            f.write(coords.tobytes())
        
        # 保存切片数据
        section_map = {str(row[section_first_col]): row[section_second_col] for _, row in sections.iterrows()}
        section_data = np.array([section_map.get(str(cell_id), '') for cell_id in cell_ids], dtype='U10')
        with open(os.path.join(self.binary_path, 'base', 'sections.bin'), 'wb') as f:
            f.write(struct.pack('I', len(section_data)))
            for section in section_data:
                section_bytes = section.encode('utf-8')
                f.write(struct.pack('I', len(section_bytes)))
                f.write(section_bytes)
        
        # 保存细胞类型数据
        celltype_map = {str(row[celltype_first_col]): row[celltype_second_col] for _, row in celltypes.iterrows()}
        celltype_data = np.array([celltype_map.get(str(cell_id), '') for cell_id in cell_ids], dtype='U50')
        with open(os.path.join(self.binary_path, 'base', 'celltypes.bin'), 'wb') as f:
            f.write(struct.pack('I', len(celltype_data)))
            for celltype in celltype_data:
                celltype_bytes = celltype.encode('utf-8')
                f.write(struct.pack('I', len(celltype_bytes)))
                f.write(celltype_bytes)
        
        return cell_id_to_index
    
    def _convert_tf_activity(self, cell_id_to_index, chunk_size=1000):
        """转换TF活性数据"""
        tf_csv_path = os.path.join(self.base_path, 'tf_activity.csv')
        
        if not os.path.exists(tf_csv_path):
            print("未找到TF活性数据文件，跳过")
            return {'total_features': 0, 'features_processed': 0, 'feature_list': []}
        
        print("转换TF活性数据...")
        
        try:
            # 先读取第一行获取列名
            first_row = pd.read_csv(tf_csv_path, nrows=1)
            features = first_row.columns[1:].tolist()  # 排除第一列细胞ID
            print(f"找到 {len(features)} 个TF")
        except Exception as e:
            print(f"读取TF活性CSV文件头失败: {e}")
            return {'total_features': 0, 'features_processed': 0, 'feature_list': []}
        
        metadata = {
            'total_features': len(features),
            'features_processed': 0,
            'feature_list': features
        }
        
        # 分批处理特征
        for i in tqdm(range(0, len(features), chunk_size), desc="处理TF"):
            chunk_features = features[i:i+chunk_size]
            
            try:
                # 只读取需要的列
                usecols = [first_row.columns[0]] + chunk_features
                df_chunk = pd.read_csv(tf_csv_path, usecols=usecols)
                
                first_col = df_chunk.columns[0]
                
                for feature in chunk_features:
                    # 提取该特征的非零值
                    feature_data = []
                    for _, row in df_chunk.iterrows():
                        cell_id = str(row[first_col])
                        value = row[feature]
                        if pd.notna(value) and value != 0:
                            cell_index = cell_id_to_index.get(cell_id)
                            if cell_index is not None:
                                feature_data.append((cell_index, float(value)))
                    
                    if feature_data:
                        # 保存为二进制格式
                        file_path = os.path.join(self.binary_path, 'tfs', f'{feature}.bin')
                        with open(file_path, 'wb') as f:
                            f.write(struct.pack('I', len(feature_data)))
                            for cell_index, value in feature_data:
                                f.write(struct.pack('If', cell_index, value))
                
                metadata['features_processed'] += len(chunk_features)
            except Exception as e:
                print(f"处理TF块 {i}-{i+chunk_size} 失败: {e}")
                continue
        
        return metadata
    
    def _create_complete_metadata(self, tf_metadata, total_cells):
        """创建完整的元数据文件"""
        # 读取基因元数据
        gene_metadata_path = os.path.join(self.binary_path, 'gene_metadata_temp.json')
        if os.path.exists(gene_metadata_path):
            with open(gene_metadata_path, 'r') as f:
                gene_metadata = json.load(f)
            # 删除临时文件
            os.remove(gene_metadata_path)
        else:
            # 如果没有基因元数据，创建空的
            gene_metadata = {'total_features': 0, 'features_processed': 0, 'feature_list': []}
            print("警告: 未找到基因元数据，请先在Jupyter中运行基因转换")
        
        metadata = {
            'version': '1.0',
            'format': 'sparse_binary',
            'total_cells': total_cells,
            'genes': {
                'total': gene_metadata['total_features'],
                'features': gene_metadata['feature_list']
            },
            'tfs': {
                'total': tf_metadata['total_features'],
                'features': tf_metadata['feature_list']
            },
            'last_updated': pd.Timestamp.now().isoformat()
        }
        
        with open(os.path.join(self.binary_path, 'metadata.json'), 'w') as f:
            json.dump(metadata, f, indent=2)

def main():
    converter = BaseDataConverter()
    converter.convert_all_base_data()

if __name__ == '__main__':
    main()